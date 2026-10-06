"""Read originals, prepare each page independently, and publish one atomic result."""
import logging
import sqlite3
from pathlib import Path
from uuid import uuid4
from app.documents.models import DocumentError
from app.documents.service import get_document, timestamp
from app.documents.storage import stored_path
from . import pdf_text
from .config import ProcessingSettings
from .models import PageResult, ProcessingRead
from .ocr import LocalOcr, OcrFailure
from .text_normalizer import normalize_text, usable_text, native_text_is_usable

LOG = logging.getLogger(__name__)


def get_processing(db: sqlite3.Connection, document_id: str) -> ProcessingRead:
    get_document(db, document_id)
    row = db.execute('SELECT * FROM document_processing WHERE document_id=?', (document_id,)).fetchone()
    if row is None:
        return ProcessingRead(document_id=document_id, state='NOT_PROCESSED')
    counts = db.execute('''SELECT COUNT(*) AS total_pages,
        COALESCE(SUM(character_count > 0 AND error_message IS NULL),0) AS pages_processed,
        COALESCE(SUM(processing_method='NATIVE_TEXT' AND character_count > 0 AND error_message IS NULL),0) AS native_text_pages,
        COALESCE(SUM(processing_method='OCR' AND character_count > 0 AND error_message IS NULL),0) AS ocr_pages,
        COALESCE(SUM(processing_method='PLAIN_TEXT' AND character_count > 0 AND error_message IS NULL),0) AS plain_text_pages,
        COALESCE(SUM(error_message IS NOT NULL OR character_count=0),0) AS pages_with_no_usable_text
        FROM document_page_text WHERE document_id=?''', (document_id,)).fetchone()
    return ProcessingRead(**dict(row), **dict(counts))


def list_pages(db: sqlite3.Connection, document_id: str):
    get_document(db, document_id)
    # Metadata only; do not send a whole manual's text in one response.
    return [dict(r) for r in db.execute('''SELECT id,document_id,page_number,processing_method,character_count,error_message,created_at,updated_at
        FROM document_page_text WHERE document_id=? ORDER BY page_number''', (document_id,))]


def get_page(db: sqlite3.Connection, document_id: str, page_number: int):
    get_document(db, document_id)
    row = db.execute('SELECT * FROM document_page_text WHERE document_id=? AND page_number=?', (document_id,page_number)).fetchone()
    if row is None:
        raise DocumentError('Prepared page not found. Prepare the document and select an available page.', 404)
    return dict(row)


def process_pdf(path: Path, settings: ProcessingSettings) -> list[PageResult]:
    results = []
    ocr = LocalOcr(settings)
    with path.open('rb') as stream:
        reader = pdf_text.open_reader(stream)
        for index in range(len(reader.pages)):
            method = 'NATIVE_TEXT'
            try:
                try:
                    text = normalize_text(pdf_text.native_text(reader, index))
                except Exception:
                    LOG.warning('Native PDF text failed for page %s; trying local OCR', index + 1, exc_info=True)
                    text = ''
                if not native_text_is_usable(text, settings.min_native_text_characters):
                    method = 'OCR'
                    available, message = ocr.availability()
                    if not available:
                        raise OcrFailure(message)
                    image = pdf_text.render_page(path, index, settings)
                    try:
                        text = normalize_text(ocr.extract(image))
                    finally:
                        image.close()
                if not usable_text(text):
                    raise OcrFailure('No usable text was found on this page after OCR. Check whether the source page is blank or image-only.')
                results.append(PageResult(index + 1, text, method))
            except (OcrFailure, pdf_text.PdfFailure) as error:
                results.append(PageResult(index + 1, '', method, str(error)))
            except Exception:
                LOG.exception('Could not prepare PDF page %s', index + 1)
                results.append(PageResult(index + 1, '', method, 'This page could not be prepared. Check the original page and try again.'))
    return results


def read_plain_text(path: Path) -> str:
    raw = path.read_bytes()
    try:
        # BOM-aware UTF-8 and UTF-16 are supported. Reject binary/unknown encodings rather than replacing characters.
        encoding = 'utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig'
        text = raw.decode(encoding)
    except UnicodeError as error:
        raise DocumentError('This text reference could not be decoded. Upload a UTF-8 or BOM-marked UTF-16 copy.', 422) from error
    controls = [c for c in text if ord(c) < 32 and c not in '\r\n\t\f']
    if controls and len(controls) > max(2, len(text) // 100):
        raise DocumentError('This file does not look like a plain text reference. Upload a UTF-8 or BOM-marked UTF-16 copy.', 422)
    return normalize_text(text)


def process_document(db: sqlite3.Connection, document_id: str, directory: Path, settings: ProcessingSettings) -> ProcessingRead:
    document = get_document(db, document_id)
    now = timestamp()
    # A committed, conditional claim prevents simultaneous reprocessing of one document.
    with db:
        claimed = db.execute('''INSERT INTO document_processing(document_id,state,message,started_at,processed_at)
            VALUES (?,'PROCESSING','Preparing document text locally.',?,NULL)
            ON CONFLICT(document_id) DO UPDATE SET state='PROCESSING',message=excluded.message,
            started_at=excluded.started_at,processed_at=NULL WHERE document_processing.state!='PROCESSING' ''', (document_id,now))
    if claimed.rowcount != 1:
        raise DocumentError('This document is already being prepared. Wait for the current preparation to finish.', 409)
    pages = []
    failure = ''
    try:
        if document.file_type not in ('PDF','TXT','MD'):
            raise DocumentError('Only PDF, TXT, and MD reference documents can be prepared.', 415)
        path = stored_path(directory, document.storage_key)
        if document.file_type == 'PDF':
            pages = process_pdf(path, settings)
        else:
            text = read_plain_text(path)
            pages = [PageResult(1, text if usable_text(text) else '', 'PLAIN_TEXT', None if usable_text(text) else 'This text reference contains no usable text.')]
    except (DocumentError, pdf_text.PdfFailure) as error:
        failure = error.message if isinstance(error, DocumentError) else str(error)
    except OSError:
        failure = 'The original file could not be read. Check local storage and try again.'
    except Exception:
        LOG.exception('Document preparation failed')
        failure = 'Document text could not be prepared. Check the original file and try again.'
    succeeded = sum(bool(page.text) and page.error is None for page in pages)
    state = 'READY' if pages and succeeded == len(pages) and not failure else 'PARTIAL' if succeeded else 'FAILED'
    reasons = list(dict.fromkeys(page.error for page in pages if page.error))
    message = failure or ('Document text is ready for future search.' if state == 'READY' else ' '.join(reasons) or 'No usable document text was produced.')
    finished = timestamp()
    # Readers see either the previous complete result or the new complete result, never half-written pages.
    with db:
        db.execute('DELETE FROM document_page_text WHERE document_id=?',(document_id,))
        db.executemany('''INSERT INTO document_page_text(id,document_id,page_number,text,processing_method,character_count,error_message,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?)''', [(str(uuid4()),document_id,p.page_number,p.text,p.method,len(p.text),p.error,finished,finished) for p in pages])
        db.execute('UPDATE document_processing SET state=?,message=?,processed_at=? WHERE document_id=?',(state,message,finished,document_id))
    return get_processing(db,document_id)


def recover_interrupted(db: sqlite3.Connection):
    """Single local server startup: a stopped attempt is never left Processing forever."""
    with db:
        db.execute('''UPDATE document_processing SET state=CASE WHEN EXISTS (
            SELECT 1 FROM document_page_text WHERE document_page_text.document_id=document_processing.document_id
            AND character_count>0 AND error_message IS NULL) THEN 'PARTIAL' ELSE 'FAILED' END,
            message='Preparation was interrupted. Any previously prepared pages are retained; reprocess to prepare the complete document.',
            processed_at=? WHERE state='PROCESSING' ''',(timestamp(),))
