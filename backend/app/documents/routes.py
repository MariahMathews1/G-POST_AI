import sqlite3
from typing import Annotated
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from pydantic import ValidationError
from app.core.database import get_database
from . import service
from .models import DocumentStatus, DocumentType
from .schemas import DocumentCreate, DocumentRead, DocumentUpdate, UploadOptions
from .storage import ALLOWED_MIME_TYPES, stored_path

router = APIRouter(prefix="/api/documents", tags=["Documents"])
Database = Annotated[sqlite3.Connection, Depends(get_database)]


@router.get("", response_model=list[DocumentRead])
def list_documents(db: Database, machine_id: str | None = None, status: DocumentStatus | None = None, document_type: DocumentType | None = None):
    return service.list_documents(db, machine_id, status, document_type)


@router.get("/upload-options", response_model=UploadOptions)
def upload_options(request: Request):
    return UploadOptions(allowed_extensions=list(ALLOWED_MIME_TYPES), max_file_size=request.app.state.max_file_size)


@router.post("", response_model=DocumentRead, status_code=201)
def upload_document(request: Request, db: Database, file: Annotated[UploadFile, File()], machine_id: Annotated[str, Form(min_length=1)], title: Annotated[str, Form(min_length=1)], document_type: Annotated[DocumentType, Form()], description: Annotated[str, Form()] = ""):
    try:
        try:
            data = DocumentCreate(machine_id=machine_id, title=title, document_type=document_type, description=description)
        except ValidationError as error:
            errors = [{**item, "loc": ("body", *item["loc"])} for item in error.errors()]
            raise RequestValidationError(errors) from error
        return service.upload_document(db, data, file, request.app.state.document_storage, request.app.state.max_file_size)
    finally:
        file.file.close()


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: str, db: Database):
    return service.get_document(db, document_id)


@router.patch("/{document_id}", response_model=DocumentRead)
def update_document(document_id: str, data: DocumentUpdate, db: Database):
    return service.update_document(db, document_id, data)


@router.get("/{document_id}/file")
def get_file(document_id: str, request: Request, db: Database, download: bool = False):
    document = service.get_document(db, document_id)
    path = stored_path(request.app.state.document_storage, document.storage_key)
    # TXT/MD are plain text, never rendered as HTML or executable Markdown.
    media_type = "application/pdf" if document.file_type == "PDF" else "text/plain; charset=utf-8"
    headers = {"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"}
    if document.file_type != "PDF":
        headers["Content-Security-Policy"] = "sandbox"
    return FileResponse(path, media_type=media_type, filename=document.original_filename, content_disposition_type="attachment" if download else "inline", headers=headers)


@router.post("/{document_id}/archive", response_model=DocumentRead)
def archive_document(document_id: str, db: Database):
    return service.set_status(db, document_id, DocumentStatus.ARCHIVED)


@router.post("/{document_id}/restore", response_model=DocumentRead)
def restore_document(document_id: str, db: Database):
    return service.set_status(db, document_id, DocumentStatus.ACTIVE)
