import sqlite3
from pathlib import Path
from fastapi import Request

MIGRATIONS = Path(__file__).resolve().parents[2] / "migrations"
MIGRATION_FILES = ["001_create_machines.sql", "002_create_documents.sql", "003_create_profile_facts.sql", "004_create_document_processing.sql", "005_create_document_page_text.sql", "006_create_profile_search_runs.sql", "007_create_profile_candidates.sql"]


def connect(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path, check_same_thread=False, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(path: Path) -> None:
    """Apply ordered migrations once; preserve existing Machine rows."""
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version > len(MIGRATION_FILES):
            raise RuntimeError("Unsupported local database version.")
        for index in range(version, len(MIGRATION_FILES)):
            connection.execute((MIGRATIONS / MIGRATION_FILES[index]).read_text())
            connection.execute(f"PRAGMA user_version = {index + 1}")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def get_database(request: Request):
    connection = connect(request.app.state.database_path)
    try:
        yield connection
    finally:
        connection.close()
