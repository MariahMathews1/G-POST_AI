from pathlib import Path
from threading import Lock
import pypdfium2 as pdfium
from PIL import Image
from pypdf import PdfReader
from .config import ProcessingSettings

# PDFium must not execute concurrently, including open/close and bitmap cleanup.
_RENDER_LOCK = Lock()


class PdfFailure(Exception):
    pass


def open_reader(stream) -> PdfReader:
    try:
        reader = PdfReader(stream)
        if reader.is_encrypted:
            raise PdfFailure('This PDF is encrypted. Upload an unencrypted reference copy to prepare its text.')
        if not len(reader.pages):
            raise PdfFailure('This PDF has no pages to prepare.')
        return reader
    except PdfFailure:
        raise
    except Exception as error:
        raise PdfFailure('This PDF is damaged or unreadable. Check the original file and upload a readable reference copy.') from error


def native_text(reader: PdfReader, index: int) -> str:
    return reader.pages[index].extract_text() or ''


def render_page(path: Path, index: int, settings: ProcessingSettings) -> Image.Image:
    try:
        with _RENDER_LOCK, pdfium.PdfDocument(path) as document:
            page = document[index]
            try:
                width, height = page.get_size()
                scale = settings.ocr_dpi / 72
                if width * height * scale * scale > settings.max_ocr_pixels:
                    raise PdfFailure('This page is too large to prepare at the configured OCR resolution.')
                bitmap = page.render(scale=scale)
                try:
                    # Copy before closing the bitmap: the adapter may share its memory.
                    return bitmap.to_pil().copy()
                finally:
                    bitmap.close()
            finally:
                page.close()
    except PdfFailure:
        raise
    except Exception as error:
        raise PdfFailure('This PDF page could not be rendered for OCR.') from error
