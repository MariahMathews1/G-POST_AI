import json
from pathlib import Path

RULES = json.loads(Path(__file__).with_name("rules.json").read_text())
CONTEXT_LINES = 1
MAX_EVIDENCE_CHARACTERS = 1200
MAX_VALUE_LINE_CHARACTERS = 600
