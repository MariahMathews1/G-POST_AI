"""Phrase matching and small context windows over selected prepared PDF pages."""

import re
from dataclasses import dataclass
from fastapi import HTTPException
from app.machine_profiles.schemas import FactInput
from app.machine_profiles.service import validate_value
from .rules import CONTEXT_LINES, MAX_EVIDENCE_CHARACTERS, MAX_VALUE_LINE_CHARACTERS
from .extractors import EXTRACTORS


@dataclass
class Match:
    value: object
    unit: str | None
    evidence: str
    method: str
    score: int


def phrase_pattern(term: str):
    words = re.split(r"[\s/-]+", term)
    return re.compile(
        r"(?<!\w)" + r"[\s/\-–‑]+".join(re.escape(w) for w in words) + r"(?!\w)",
        re.IGNORECASE,
    )


def evidence_window(text: str, start: int, end: int) -> str:
    lines = text.splitlines()
    first = text[:start].count("\n")
    last = text[:end].count("\n")
    window = "\n".join(lines[max(0, first - CONTEXT_LINES) : last + CONTEXT_LINES + 2])
    # Keep the match visible even for unusually long source lines.
    if len(window) > MAX_EVIDENCE_CHARACTERS:
        left = max(0, start - 200)
        window = text[left : left + MAX_EVIDENCE_CHARACTERS]
    return window


def value_tail(text: str, end: int) -> str:
    line_end = text.find("\n", end)
    line_end = len(text) if line_end == -1 else line_end
    tail = text[end:line_end].strip()
    if not tail.strip(" :=.·…") and line_end < len(text):
        tail = text[line_end + 1 :].split("\n", 1)[0].strip()
    return tail[:MAX_VALUE_LINE_CHARACTERS]


def search_page(text: str, definition: dict, rule: dict) -> list[Match]:
    hits = []
    seen = set()
    extractor = EXTRACTORS[rule["extractor"]]
    for related, terms in [
        (False, rule["search_terms"]),
        (True, rule.get("related_search_terms", [])),
    ]:
        for term in terms:
            for match in phrase_pattern(term).finditer(text):
                # Several aliases often overlap the same heading.
                marker = (match.start(), related)
                if marker in seen:
                    continue
                seen.add(marker)
                extracted = (
                    None if related else extractor(value_tail(text, match.end()), rule)
                )
                if extracted:
                    value, unit = extracted
                    try:
                        validate_value(definition, FactInput(value=value, unit=unit))
                    except HTTPException:
                        extracted = None
                evidence = evidence_window(text, match.start(), match.end())
                hits.append(
                    Match(
                        extracted[0] if extracted else None,
                        extracted[1] if extracted else None,
                        evidence,
                        "PHRASE_VALUE" if extracted else "RELATED_PHRASE",
                        100 if extracted else 20,
                    )
                )
    return hits
