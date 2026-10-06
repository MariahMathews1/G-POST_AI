import json
import math
import sqlite3
from datetime import datetime, timezone
from fastapi import HTTPException
from app.machines.service import get_machine
from .catalog import CATALOG, DEFINITIONS, applicable
from .schemas import FactInput


def invalid(message: str):
    raise HTTPException(status_code=422, detail=message)


def validate_value(definition: dict, data: FactInput):
    value = data.value.strip() if isinstance(data.value, str) else data.value
    empty = value is None or value == '' or value == []
    if data.status in ('MISSING', 'NOT_APPLICABLE'):
        if not empty:
            invalid('Missing or not applicable information must have an empty value.')
        if data.unit:
            invalid('An empty value cannot have a unit.')
        return None
    if empty:
        invalid('Enter a value before requesting review or confirming information.')
    kind = definition['value_type']
    if kind in ('text', 'choice'):
        if not isinstance(value, str) or len(value) > 20000:
            invalid('Enter a text value of at most 20,000 characters.')
        if kind == 'choice' and value not in definition['choices']:
            invalid('Select one of the defined choices.')
    elif kind in ('number', 'integer'):
        if type(value) not in (int, float) or not math.isfinite(value):
            invalid('Enter a finite numeric value.')
        if kind == 'integer' and (value < 1 or value != int(value)):
            invalid('Enter a positive whole number of controlled axes.')
        if definition['key'].startswith('maximum_') and value <= 0:
            invalid('The maximum speed or feedrate must be positive.')
    elif kind == 'list':
        if not isinstance(value, list) or len(value) > 500 or any(not isinstance(item, str) or not item.strip() or len(item) > 2000 for item in value):
            invalid('Enter a list of nonempty text items.')
        value = list(dict.fromkeys(item.strip() for item in value))
    elif kind == 'rotary_axes':
        if not isinstance(value, list) or not 1 <= len(value) <= 3:
            invalid('Enter one to three rotary axis definitions.')
        seen = set()
        for item in value:
            if not isinstance(item, dict) or set(item) != {'axis', 'minimum_angle', 'maximum_angle', 'continuous'}:
                invalid('Each rotary axis needs an axis, minimum angle, maximum angle, and continuous flag.')
            if item['axis'] not in ('A', 'B', 'C') or item['axis'] in seen:
                invalid('Use each rotary axis A, B, or C at most once.')
            seen.add(item['axis'])
            if type(item['continuous']) is not bool or any(type(item[k]) not in (int, float) or not math.isfinite(item[k]) for k in ('minimum_angle', 'maximum_angle')):
                invalid('Enter numeric angles and a continuous flag for each rotary axis.')
            if item['minimum_angle'] > item['maximum_angle']:
                invalid('The minimum angle cannot exceed the maximum angle.')
    units = definition['allowed_units']
    if units and data.unit not in units:
        invalid('Select an allowed unit for this information.')
    if not units and data.unit:
        invalid('This information does not accept a separate unit.')
    return value


def get_profile(db: sqlite3.Connection, machine_id: str):
    machine = get_machine(db, machine_id)
    saved = {r['fact_key']: dict(r) for r in db.execute('SELECT * FROM profile_facts WHERE machine_id = ?', (machine_id,))}
    facts = []
    summary = {'confirmed': 0, 'needs_review': 0, 'missing': 0}
    for definition in CATALOG['definitions']:
        is_applicable = applicable(definition, machine.machine_type)
        if not is_applicable and definition['key'] not in saved:
            continue
        field = definition.get('machine_field')
        fact = dict(definition=definition, applicable=is_applicable, value=None, unit=None, status='MISSING', source_type='PROGRAMMER_ENTRY', source_document_id=None, source_location='', engineering_notes='', created_at=None, updated_at=None)
        if field:
            # Identity is already owned by Machine; it is not a manual review decision.
            fact.update(value=getattr(machine, field), status=None, source_type='MACHINE_RECORD', created_at=machine.created_at, updated_at=machine.updated_at)
        elif definition['key'] in saved:
            row = saved[definition['key']]
            fact.update({k: row[k] for k in ('unit', 'status', 'source_type', 'source_document_id', 'source_location', 'engineering_notes', 'created_at', 'updated_at')})
            fact['value'] = json.loads(row['value_json']) if row['value_json'] else None
        if not field:
            if fact['status'] == 'CONFIRMED': summary['confirmed'] += 1
            elif fact['status'] == 'NEEDS_REVIEW': summary['needs_review'] += 1
            elif fact['status'] == 'MISSING' and is_applicable and definition['normally_important']: summary['missing'] += 1
        facts.append(fact)
    return dict(machine_id=machine_id, categories=CATALOG['categories'], facts=facts, summary=summary)


def save_fact(db: sqlite3.Connection, machine_id: str, key: str, data: FactInput, *, commit: bool = True):
    machine = get_machine(db, machine_id)
    definition = DEFINITIONS.get(key)
    if not definition:
        raise HTTPException(status_code=404, detail='Information definition not found.')
    if definition.get('machine_field'):
        invalid('This information comes from the Machine record. Edit the Machine to change it.')
    # Also permit a previously saved fact after a Machine type change.
    if not applicable(definition, machine.machine_type) and not db.execute('SELECT 1 FROM profile_facts WHERE machine_id=? AND fact_key=?', (machine_id, key)).fetchone():
        invalid('This information does not apply to this machine type.')
    value = validate_value(definition, data)
    document_id = data.source_document_id or None
    if document_id and not db.execute('SELECT 1 FROM documents WHERE id=? AND machine_id=?', (document_id, machine_id)).fetchone():
        invalid('Select an existing document associated with this machine.')
    now = datetime.now(timezone.utc).isoformat()
    db.execute('''INSERT INTO profile_facts (machine_id, fact_key, value_json, unit, status, source_type, source_document_id, source_location, engineering_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(machine_id, fact_key) DO UPDATE SET value_json=excluded.value_json, unit=excluded.unit, status=excluded.status,
        source_type=excluded.source_type, source_document_id=excluded.source_document_id, source_location=excluded.source_location,
        engineering_notes=excluded.engineering_notes, updated_at=excluded.updated_at''',
        (machine_id, key, json.dumps(value, allow_nan=False) if value is not None else None, data.unit, data.status, 'DOCUMENT_REFERENCE' if document_id else 'PROGRAMMER_ENTRY', document_id, data.source_location, data.engineering_notes, now, now))
    if commit:
        db.commit()
    return get_profile(db, machine_id)
