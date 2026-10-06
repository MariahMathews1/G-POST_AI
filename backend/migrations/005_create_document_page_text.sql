CREATE TABLE document_page_text (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
    page_number INTEGER NOT NULL CHECK (page_number > 0),
    text TEXT NOT NULL,
    processing_method TEXT NOT NULL CHECK (processing_method IN ('NATIVE_TEXT','OCR','PLAIN_TEXT')),
    character_count INTEGER NOT NULL CHECK (character_count >= 0),
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(document_id, page_number)
)
