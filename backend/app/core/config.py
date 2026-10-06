import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def database_path() -> Path:
    """Use a stable local path even if the server starts from another directory."""
    configured = os.environ.get("COMPANION_DB_PATH")
    return Path(configured).expanduser().resolve() if configured else BACKEND_ROOT / "data" / "companion.sqlite3"
