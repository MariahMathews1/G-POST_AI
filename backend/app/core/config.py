import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def database_path() -> Path:
    """Use a stable local path even if the server starts from another directory."""
    configured = os.environ.get("COMPANION_DB_PATH")
    return Path(configured).expanduser().resolve() if configured else BACKEND_ROOT / "data" / "companion.sqlite3"


def document_storage_path(db_path: Path) -> Path:
    configured = os.environ.get("COMPANION_DOCUMENTS_DIR")
    return Path(configured).expanduser().resolve() if configured else db_path.parent / "documents"


def maximum_upload_size() -> int:
    megabytes = int(os.environ.get("COMPANION_MAX_UPLOAD_MB", "25"))
    if megabytes <= 0:
        raise ValueError("COMPANION_MAX_UPLOAD_MB must be a positive number.")
    return megabytes * 1024 * 1024
