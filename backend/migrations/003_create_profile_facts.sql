CREATE TABLE profile_facts (
    machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
    fact_key TEXT NOT NULL,
    value_json TEXT,
    unit TEXT,
    status TEXT NOT NULL CHECK (status IN ('MISSING', 'NEEDS_REVIEW', 'CONFIRMED', 'NOT_APPLICABLE')),
    source_type TEXT NOT NULL CHECK (source_type IN ('PROGRAMMER_ENTRY', 'DOCUMENT_REFERENCE')),
    source_document_id TEXT REFERENCES documents(id) ON DELETE RESTRICT,
    source_location TEXT NOT NULL DEFAULT '',
    engineering_notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (machine_id, fact_key)
)
