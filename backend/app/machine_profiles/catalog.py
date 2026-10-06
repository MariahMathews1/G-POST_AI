"""Shared, configuration-driven fact definitions. Never machine-specific values."""
import json
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name('definitions.json').read_text())
DEFINITIONS = {item['key']: item for item in CATALOG['definitions']}
assert len(DEFINITIONS) == len(CATALOG['definitions']), 'Duplicate definition keys'


def applicable(definition: dict, machine_type: str) -> bool:
    types = definition['applicable_machine_types']
    return 'ALL' in types or machine_type in types
