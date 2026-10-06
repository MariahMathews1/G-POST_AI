CREATE TABLE document_processing (
    document_id TEXT PRIMARY KEY REFERENCES documents(id) ON DELETE RESTRICT,
    state TEXT NOT NULL CHECK (state IN ('NOT_PROCESSED','PROCESSING','READY','PARTIAL','FAILED')),
    message TEXT NOT NULL DEFAULT '',
    started_at TEXT,
    processed_at TEXT
)
