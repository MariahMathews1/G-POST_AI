import sqlite3
from typing import Annotated
from fastapi import APIRouter, Depends
from app.core.database import get_database
from . import service
from .models import MachineStatus
from .schemas import MachineCreate, MachineRead, MachineUpdate

router = APIRouter(prefix="/api/machines", tags=["Machines"])
Database = Annotated[sqlite3.Connection, Depends(get_database)]


@router.get("", response_model=list[MachineRead])
def list_machines(db: Database, status: MachineStatus | None = None):
    return service.list_machines(db, status)


@router.post("", response_model=MachineRead, status_code=201)
def create_machine(data: MachineCreate, db: Database):
    return service.create_machine(db, data)


@router.get("/{machine_id}", response_model=MachineRead)
def get_machine(machine_id: str, db: Database):
    return service.get_machine(db, machine_id)


@router.put("/{machine_id}", response_model=MachineRead)
def update_machine(machine_id: str, data: MachineUpdate, db: Database):
    return service.update_machine(db, machine_id, data)


@router.post("/{machine_id}/archive", response_model=MachineRead)
def archive_machine(machine_id: str, db: Database):
    return service.set_status(db, machine_id, MachineStatus.ARCHIVED)


@router.post("/{machine_id}/restore", response_model=MachineRead)
def restore_machine(machine_id: str, db: Database):
    return service.set_status(db, machine_id, MachineStatus.ACTIVE)
