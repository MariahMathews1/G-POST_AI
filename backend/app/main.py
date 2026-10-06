import logging
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.core.config import database_path
from app.core.database import initialize_database
from app.machines.routes import router
from app.machines.service import MachineNotFound


def create_app(db_path: Path | None = None) -> FastAPI:
    path = db_path if db_path is not None else database_path()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        initialize_database(path)
        yield

    app = FastAPI(title="Creo NC G-POST Companion", lifespan=lifespan)
    app.state.database_path = path
    app.include_router(router)

    @app.exception_handler(MachineNotFound)
    async def not_found(request: Request, exception: MachineNotFound):
        return JSONResponse(status_code=404, content={"detail": "Machine not found."})

    @app.exception_handler(sqlite3.Error)
    async def database_error(request: Request, exception: sqlite3.Error):
        logging.getLogger(__name__).error("Machine database operation failed", exc_info=exception)
        return JSONResponse(status_code=503, content={"detail": "Machine data is temporarily unavailable. Try again."})

    return app


app = create_app()
