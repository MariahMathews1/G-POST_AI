CREATE TABLE documents (
    id TEXT PRIMARY KEY NOT NULL,
    machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    document_type TEXT NOT NULL CHECK (document_type IN ('MACHINE_MANUAL', 'CONTROLLER_MANUAL', 'PROGRAMMING_MANUAL', 'SPECIFICATION_SHEET', 'GPOST_OFG_REFERENCE', 'APPROVED_INTERNAL_REFERENCE', 'OTHER')),
    original_filename TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    file_type TEXT NOT NULL CHECK (file_type IN ('PDF', 'TXT', 'MD')),
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
