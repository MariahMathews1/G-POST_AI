from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class FactInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    value: Any = None
    unit: str | None = None
    status: Literal['MISSING', 'NEEDS_REVIEW', 'CONFIRMED', 'NOT_APPLICABLE'] = 'NEEDS_REVIEW'
    source_document_id: str | None = None
    source_location: str = Field(default='', max_length=2000)
    engineering_notes: str = Field(default='', max_length=20000)

    @field_validator('unit', 'source_document_id', 'source_location', 'engineering_notes', mode='before')
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value
