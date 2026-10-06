from dataclasses import dataclass
from enum import StrEnum


class DocumentStatus(StrEnum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class DocumentType(StrEnum):
    MACHINE_MANUAL = "MACHINE_MANUAL"
    CONTROLLER_MANUAL = "CONTROLLER_MANUAL"
    PROGRAMMING_MANUAL = "PROGRAMMING_MANUAL"
    SPECIFICATION_SHEET = "SPECIFICATION_SHEET"
    GPOST_OFG_REFERENCE = "GPOST_OFG_REFERENCE"
    APPROVED_INTERNAL_REFERENCE = "APPROVED_INTERNAL_REFERENCE"
    OTHER = "OTHER"


@dataclass
class Document:
    id: str
    machine_id: str
    title: str
    document_type: str
    original_filename: str
    storage_key: str
    file_type: str
    file_size: int
    description: str
    status: str
    created_at: str
    updated_at: str
    machine_name: str  # Joined for display; not an extra stored column.


class DocumentError(Exception):
    def __init__(self, message: str, status: int = 400, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.field = field
