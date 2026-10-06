from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from .models import DocumentStatus, DocumentType


class DocumentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    machine_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    document_type: DocumentType
    description: str = ""


class DocumentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str | None = Field(default=None, min_length=1)
    document_type: DocumentType | None = None
    description: str | None = None

    @field_validator("title", "document_type", "description", mode="before")
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("Provide a value or omit the field.")
        return value

    @model_validator(mode="after")
    def require_a_change(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one metadata field.")
        return self


class DocumentRead(DocumentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    machine_name: str
    original_filename: str
    storage_key: str
    file_type: str
    file_size: int
    status: DocumentStatus
    created_at: str
    updated_at: str


class UploadOptions(BaseModel):
    allowed_extensions: list[str]
    max_file_size: int
