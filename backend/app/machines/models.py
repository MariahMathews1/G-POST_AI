from dataclasses import dataclass
from enum import StrEnum


class MachineStatus(StrEnum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class MachineType(StrEnum):
    LATHE = "Lathe"
    MILL = "Mill"
    MILL_TURN = "Mill-Turn"
    SWISS = "Swiss"
    OTHER = "Other"


@dataclass
class Machine:
    """One persisted row in the machines table; no future feature metadata."""
    id: str
    name: str
    manufacturer: str
    model: str
    machine_type: str
    controller: str
    notes: str
    status: str
    created_at: str
    updated_at: str
