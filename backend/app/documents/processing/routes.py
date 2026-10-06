from fastapi import APIRouter, Request
from app.documents.routes import Database
from app.documents.models import DocumentError
from . import processor
from .models import ProcessingRead, PageSummary, PageRead

router = APIRouter(prefix='/api/documents', tags=['Document Text'])


@router.post('/{document_id}/process', response_model=ProcessingRead)
def process(document_id: str, request: Request, db: Database):
    return processor.process_document(db, document_id, request.app.state.document_storage, request.app.state.processing_settings)


@router.get('/{document_id}/processing', response_model=ProcessingRead)
def status(document_id: str, db: Database):
    return processor.get_processing(db,document_id)


@router.get('/{document_id}/pages', response_model=list[PageSummary])
def pages(document_id: str, db: Database):
    return processor.list_pages(db,document_id)


@router.get('/{document_id}/pages/{page_number}', response_model=PageRead)
def page(document_id: str, page_number: int, db: Database):
    if page_number <= 0:
        raise DocumentError('Choose a one-based PDF page number.', 422)
    return processor.get_page(db,document_id,page_number)
