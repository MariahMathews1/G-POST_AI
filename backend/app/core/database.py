import sqlite3
from pathlib import Path
from fastapi import Request

MIGRATION = Path(__file__).resolve().parents[2] / "migrations" / "001_create_machines.sql"


def connect(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path, check_same_thread=False, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database(path: Path) -> None:
    """Apply the single initial migration once; SQLite user_version avoids an extra table."""
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = connect(path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version == 0:
            connection.execute(MIGRATION.read_text())
            connection.execute("PRAGMA user_version = 1")
        elif version != 1:
            raise RuntimeError("Unsupported local database version.")
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
