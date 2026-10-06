import logging
import re
from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile
from .models import DocumentError

ALLOWED_MIME_TYPES = {
    ".pdf": {"application/pdf", "application/octet-stream", ""},
    ".txt": {"text/plain", "application/octet-stream", ""},
    ".md": {"text/markdown", "text/x-markdown", "text/plain", "application/octet-stream", ""},
}
STORAGE_KEY = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|txt|md)")


def discard_failed_upload(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logging.getLogger(__name__).exception("Could not remove a failed upload from local storage")


def original_name(filename: str | None) -> str:
    # Browsers supply a base name. Strip any supplied directory/control characters.
    name = (filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    return "".join(char for char in name if ord(char) >= 32 and ord(char) != 127).strip()


def store_file(upload: UploadFile, directory: Path, max_file_size: int) -> tuple[str, str, str, int]:
    name = original_name(upload.filename)
    extension = Path(name).suffix.lower()
    if extension not in ALLOWED_MIME_TYPES:
        raise DocumentError("Unsupported file. Choose a PDF, TXT, or MD reference document.", 415, "file")
    mime = (upload.content_type or "").split(";", 1)[0].strip().lower()
    if mime not in ALLOWED_MIME_TYPES[extension]:
        raise DocumentError("The file type does not match the allowed reference formats.", 415, "file")
    key = f"{uuid4()}{extension}"
    path = directory / key
    size = 0
    try:
        directory.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as target:
            while chunk := upload.file.read(1024 * 1024):
                size += len(chunk)
                if size > max_file_size:
                    raise DocumentError(f"File exceeds the {max_file_size / (1024 * 1024):g} MB upload limit.", 413, "file")
                # Only a signature check, never PDF parsing or text extraction.
                if size == len(chunk) and extension == ".pdf" and not chunk.startswith(b"%PDF-"):
                    raise DocumentError("The file does not have a PDF header. Choose a PDF document.", 415, "file")
                target.write(chunk)
        if size == 0:
            raise DocumentError("The file is empty. Choose a non-empty reference document.", 400, "file")
    except (OSError, DocumentError) as error:
        discard_failed_upload(path)
        if isinstance(error, DocumentError):
            raise
        raise DocumentError("The document could not be stored. Try again.", 503) from error
    return name, key, extension[1:].upper(), size


def stored_path(directory: Path, storage_key: str) -> Path:
    if not STORAGE_KEY.fullmatch(storage_key):
        raise DocumentError("The original file is unavailable in storage.", 404)
    path = (directory / storage_key).resolve()
    if path.parent != directory.resolve() or not path.is_file():
        raise DocumentError("The original file is missing from storage. The document metadata is still available.", 404)
    return path
