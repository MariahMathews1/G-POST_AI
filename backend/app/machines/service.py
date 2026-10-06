import sqlite3
from datetime import datetime, timezone
from uuid import uuid4
from .models import Machine, MachineStatus
from .schemas import MachineCreate, MachineUpdate


class MachineNotFound(Exception):
    pass


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_machines(db: sqlite3.Connection, status: MachineStatus | None = None) -> list[Machine]:
    if status is None:
        rows = db.execute("SELECT * FROM machines ORDER BY created_at DESC, id").fetchall()
    else:
        rows = db.execute("SELECT * FROM machines WHERE status = ? ORDER BY created_at DESC, id", (status.value,)).fetchall()
    return [Machine(**dict(row)) for row in rows]


def get_machine(db: sqlite3.Connection, machine_id: str) -> Machine:
    row = db.execute("SELECT * FROM machines WHERE id = ?", (machine_id,)).fetchone()
    if row is None:
        raise MachineNotFound()
    return Machine(**dict(row))


def create_machine(db: sqlite3.Connection, data: MachineCreate) -> Machine:
    values = data.model_dump(mode="json")
    values.update(id=str(uuid4()), created_at=timestamp())
    values["updated_at"] = values["created_at"]
    with db:
        db.execute("""INSERT INTO machines
            (id, name, manufacturer, model, machine_type, controller, notes, status, created_at, updated_at)
            VALUES (:id, :name, :manufacturer, :model, :machine_type, :controller, :notes, :status, :created_at, :updated_at)""", values)
    return get_machine(db, values["id"])


def update_machine(db: sqlite3.Connection, machine_id: str, data: MachineUpdate) -> Machine:
    values = data.model_dump(mode="json")
    values.update(id=machine_id, updated_at=timestamp())
    with db:
        cursor = db.execute("""UPDATE machines SET name=:name, manufacturer=:manufacturer, model=:model,
            machine_type=:machine_type, controller=:controller, notes=:notes, updated_at=:updated_at WHERE id=:id""", values)
        if cursor.rowcount == 0:
            raise MachineNotFound()
    return get_machine(db, machine_id)


def set_status(db: sqlite3.Connection, machine_id: str, status: MachineStatus) -> Machine:
    with db:
        cursor = db.execute("UPDATE machines SET status = ?, updated_at = ? WHERE id = ?", (status.value, timestamp(), machine_id))
        if cursor.rowcount == 0:
            raise MachineNotFound()
    return get_machine(db, machine_id)
