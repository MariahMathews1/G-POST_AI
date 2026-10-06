import sqlite3
from typing import Annotated
from fastapi import APIRouter, Depends
from app.core.database import get_database
from .catalog import CATALOG
from .schemas import FactInput
from .service import get_profile, save_fact

router = APIRouter(prefix='/api', tags=['Machine Profile'])
Database = Annotated[sqlite3.Connection, Depends(get_database)]


@router.get('/profile-definitions')
def definitions():
    return CATALOG


@router.get('/machines/{machine_id}/profile')
def profile(machine_id: str, db: Database):
    return get_profile(db, machine_id)


@router.put('/machines/{machine_id}/profile/facts/{fact_key}')
def save(machine_id: str, fact_key: str, data: FactInput, db: Database):
    return save_fact(db, machine_id, fact_key, data)
