import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile
from .models import Document, DocumentError, DocumentStatus, DocumentType
from .schemas import DocumentCreate, DocumentUpdate
from .storage import store_file, discard_failed_upload

SELECT_DOCUMENT = "SELECT documents.*, machines.name AS machine_name FROM documents JOIN machines ON machines.id = documents.machine_id"


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_documents(db: sqlite3.Connection, machine_id: str | None = None, status: DocumentStatus | None = None, document_type: DocumentType | None = None) -> list[Document]:
    clauses = []
    values = []
    for column, value in [("machine_id", machine_id), ("status", status), ("document_type", document_type)]:
        if value is not None:
            clauses.append(f"documents.{column} = ?")
            values.append(str(value))
    where = " WHERE " + " AND ".join(clauses) if clauses else ""
    rows = db.execute(SELECT_DOCUMENT + where + " ORDER BY documents.created_at DESC, documents.id", values).fetchall()
    return [Document(**dict(row)) for row in rows]


def get_document(db: sqlite3.Connection, document_id: str) -> Document:
    row = db.execute(SELECT_DOCUMENT + " WHERE documents.id = ?", (document_id,)).fetchone()
    if row is None:
        raise DocumentError("Document not found.", 404)
    return Document(**dict(row))


def upload_document(db: sqlite3.Connection, data: DocumentCreate, upload: UploadFile, directory: Path, max_file_size: int) -> Document:
    if db.execute("SELECT id FROM machines WHERE id = ?", (data.machine_id,)).fetchone() is None:
        raise DocumentError("Select a saved Machine before uploading a document.", 404, "machine_id")
    name, key, file_type, size = store_file(upload, directory, max_file_size)
    values = data.model_dump(mode="json")
    values.update(id=str(uuid4()), original_filename=name, storage_key=key, file_type=file_type, file_size=size, created_at=timestamp())
    values["updated_at"] = values["created_at"]
    try:
        with db:
            db.execute("""INSERT INTO documents
                (id, machine_id, title, document_type, original_filename, storage_key, file_type, file_size, description, created_at, updated_at)
                VALUES (:id, :machine_id, :title, :document_type, :original_filename, :storage_key, :file_type, :file_size, :description, :created_at, :updated_at)""", values)
    except Exception:
        # A failed metadata write must not leave an accepted orphan file.
        discard_failed_upload(directory / key)
        raise
    return get_document(db, values["id"])


def update_document(db: sqlite3.Connection, document_id: str, data: DocumentUpdate) -> Document:
    get_document(db, document_id)
    changes = data.model_dump(exclude_unset=True, mode="json")
    changes["updated_at"] = timestamp()
    assignments = ", ".join(f"{field} = ?" for field in changes)
    with db:
        db.execute(f"UPDATE documents SET {assignments} WHERE id = ?", [*changes.values(), document_id])
    return get_document(db, document_id)


def set_status(db: sqlite3.Connection, document_id: str, status: DocumentStatus) -> Document:
    with db:
        cursor = db.execute("UPDATE documents SET status = ?, updated_at = ? WHERE id = ?", (status.value, timestamp(), document_id))
        if cursor.rowcount == 0:
            raise DocumentError("Document not found.", 404)
    return get_document(db, document_id)
