CREATE TABLE profile_candidates (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES profile_search_runs(id) ON DELETE RESTRICT,
    machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
    fact_key TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('VALUE','RELATED_EVIDENCE')),
    candidate_value_json TEXT,
    candidate_unit TEXT,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
    page_number INTEGER NOT NULL CHECK (page_number > 0),
    evidence_text TEXT NOT NULL,
    match_method TEXT NOT NULL,
    match_score INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PROPOSED','APPLIED','REJECTED')),
    created_at TEXT NOT NULL,
    reviewed_at TEXT
)
