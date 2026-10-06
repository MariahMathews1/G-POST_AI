CREATE TABLE profile_search_runs (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE RESTRICT,
    selected_fact_keys_json TEXT NOT NULL,
    selected_document_ids_json TEXT NOT NULL,
    document_snapshots_json TEXT NOT NULL,
    results_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL
)
