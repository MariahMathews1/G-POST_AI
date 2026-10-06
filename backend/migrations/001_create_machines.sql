CREATE TABLE machines (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    manufacturer TEXT NOT NULL CHECK (length(trim(manufacturer)) > 0),
    model TEXT NOT NULL CHECK (length(trim(model)) > 0),
    machine_type TEXT NOT NULL CHECK (machine_type IN ('Lathe', 'Mill', 'Mill-Turn', 'Swiss', 'Other')),
    controller TEXT NOT NULL CHECK (length(trim(controller)) > 0),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
