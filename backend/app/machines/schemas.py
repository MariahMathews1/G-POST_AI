from pydantic import BaseModel, ConfigDict, Field, field_validator
from .models import MachineStatus, MachineType


class MachineInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    manufacturer: str = Field(min_length=1)
    model: str = Field(min_length=1)
    machine_type: MachineType
    controller: str = Field(min_length=1)
    notes: str = ""

    @field_validator("name", "manufacturer", "model", "machine_type", "controller", "notes", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class MachineCreate(MachineInput):
    status: MachineStatus = MachineStatus.ACTIVE


class MachineUpdate(MachineInput):
    """PUT replaces editable fields; archive/restore are separate explicit actions."""


class MachineRead(MachineInput):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: MachineStatus
    created_at: str
    updated_at: str
