import logging
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from app.core.config import database_path, document_storage_path, maximum_upload_size
from app.core.database import initialize_database, connect
from app.machines.routes import router
from app.machines.service import MachineNotFound
from app.documents.routes import router as documents_router
from app.documents.models import DocumentError
from app.machine_profiles.routes import router as profiles_router
from app.documents.processing.routes import router as processing_router
from app.documents.processing.config import ProcessingSettings
from app.documents.processing.processor import recover_interrupted
from app.profile_extraction.routes import router as extraction_router


def create_app(db_path: Path | None = None, storage_dir: Path | None = None, max_file_size: int | None = None) -> FastAPI:
    path = db_path if db_path is not None else database_path()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        initialize_database(path)
        database = connect(path)
        try:
            recover_interrupted(database)
        finally:
            database.close()
        app.state.document_storage.mkdir(parents=True, exist_ok=True)
        yield

    app = FastAPI(title="Creo NC G-POST Companion", lifespan=lifespan)
    app.state.database_path = path
    app.include_router(router)
    app.include_router(documents_router)
    app.include_router(profiles_router)
    app.include_router(processing_router)
    app.include_router(extraction_router)
    app.state.processing_settings = ProcessingSettings.from_environment()
    app.state.document_storage = storage_dir if storage_dir is not None else document_storage_path(path)
    app.state.max_file_size = max_file_size if max_file_size is not None else maximum_upload_size()
    if app.state.max_file_size <= 0:
        raise ValueError("Upload limit must be positive.")

    @app.exception_handler(DocumentError)
    async def document_error(request: Request, exception: DocumentError):
        if request.url.path.endswith("/file"):
            return PlainTextResponse(exception.message, status_code=exception.status, headers={"X-Content-Type-Options": "nosniff"})
        content = {"detail": exception.message}
        if exception.field:
            content["field"] = exception.field
        return JSONResponse(status_code=exception.status, content=content)

    @app.exception_handler(MachineNotFound)
    async def not_found(request: Request, exception: MachineNotFound):
        return JSONResponse(status_code=404, content={"detail": "Machine not found."})

    @app.exception_handler(sqlite3.Error)
    async def database_error(request: Request, exception: sqlite3.Error):
        logging.getLogger(__name__).error("Application database operation failed", exc_info=exception)
        return JSONResponse(status_code=503, content={"detail": "Data is temporarily unavailable. Try again."})

    return app


app = create_app()
