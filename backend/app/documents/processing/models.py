from dataclasses import dataclass
from typing import Literal
from pydantic import BaseModel

ProcessingState = Literal['NOT_PROCESSED', 'PROCESSING', 'READY', 'PARTIAL', 'FAILED']
ProcessingMethod = Literal['NATIVE_TEXT', 'OCR', 'PLAIN_TEXT']


class ProcessingRead(BaseModel):
    document_id: str
    state: ProcessingState
    total_pages: int = 0
    pages_processed: int = 0
    native_text_pages: int = 0
    ocr_pages: int = 0
    plain_text_pages: int = 0
    pages_with_no_usable_text: int = 0
    message: str = ''
    started_at: str | None = None
    processed_at: str | None = None


class PageSummary(BaseModel):
    id: str
    document_id: str
    page_number: int
    processing_method: ProcessingMethod
    character_count: int
    error_message: str | None = None
    created_at: str
    updated_at: str


class PageRead(PageSummary):
    text: str


@dataclass
class PageResult:
    page_number: int
    text: str
    method: str
    error: str | None = None
