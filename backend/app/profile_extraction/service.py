import json
import logging
import sqlite3
from uuid import uuid4
from fastapi import HTTPException
from app.machines.service import get_machine
from app.documents.service import get_document, timestamp, SELECT_DOCUMENT
from app.machine_profiles.catalog import DEFINITIONS, applicable
from app.machine_profiles.schemas import FactInput
from app.machine_profiles.service import get_profile, save_fact
from .rules import RULES
from .schemas import FindInput
from .search import search_page

LOG = logging.getLogger(__name__)


def fail(message: str, status=422):
    raise HTTPException(status_code=status, detail=message)


def eligible_documents(db: sqlite3.Connection, machine_id: str):
    get_machine(db, machine_id)
    rows = db.execute(
        SELECT_DOCUMENT.replace(
            "SELECT documents.*",
            "SELECT documents.*, document_processing.state AS processing_state",
        )
        + """ JOIN document_processing ON document_processing.document_id=documents.id
        WHERE documents.machine_id=? AND documents.status='ACTIVE' AND document_processing.state IN ('READY','PARTIAL') AND documents.file_type IN ('PDF','TXT','MD')
        AND EXISTS (SELECT 1 FROM document_page_text WHERE document_id=documents.id AND character_count>0 AND error_message IS NULL)
        ORDER BY documents.title,documents.id""",
        (machine_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def candidate_read(row, snapshots):
    result = dict(row)
    value_json = result.pop("candidate_value_json")
    result["candidate_value"] = json.loads(value_json) if value_json else None
    result.pop("match_score")
    result["document_title"] = snapshots[result["document_id"]]["title"]
    result["file_type"] = snapshots[result["document_id"]]["file_type"]
    return result


def get_run(db: sqlite3.Connection, machine_id: str, run_id: str | None = None):
    get_machine(db, machine_id)
    row = db.execute(
        "SELECT * FROM profile_search_runs WHERE machine_id=?"
        + (" AND id=?" if run_id else "")
        + " ORDER BY started_at DESC,id DESC LIMIT 1",
        (machine_id, run_id) if run_id else (machine_id,),
    ).fetchone()
    if row is None:
        if run_id:
            fail("Search results not found for this Machine.", 404)
        return None
    result = dict(row)
    snapshots = json.loads(result.pop("document_snapshots_json"))
    result["documents"] = list(snapshots.values())
    for column in ["selected_fact_keys", "selected_document_ids", "results"]:
        result[column] = json.loads(result.pop(column + "_json"))
    candidates = db.execute(
        "SELECT * FROM profile_candidates WHERE run_id=? ORDER BY match_score DESC,document_id,page_number,id",
        (result["id"],),
    ).fetchall()
    for group in result["results"]:
        group["candidates"] = [
            candidate_read(c, snapshots)
            for c in candidates
            if c["fact_key"] == group["fact_key"]
        ]
    return result


def find_information(db: sqlite3.Connection, machine_id: str, data: FindInput):
    machine = get_machine(db, machine_id)
    keys = list(dict.fromkeys(data.fact_keys))
    doc_ids = list(dict.fromkeys(data.document_ids))
    for key in keys:
        definition = DEFINITIONS.get(key)
        if (
            not definition
            or key not in RULES
            or definition.get("machine_field")
            or not applicable(definition, machine.machine_type)
        ):
            fail(
                "Select applicable profile information supported by deterministic search."
            )
    eligible = {d["id"]: d for d in eligible_documents(db, machine_id)}
    if any(did not in eligible for did in doc_ids):
        fail(
            "Select active, prepared PDF/TXT/MD references associated with this Machine."
        )
    documents = [eligible[did] for did in doc_ids]
    started = timestamp()
    run_id = str(uuid4())
    groups = []
    candidates = []
    snapshots = {
        d["id"]: {
            k: d[k]
            for k in ["id", "title", "document_type", "file_type", "processing_state"]
        }
        for d in documents
    }
    source_pages = {
        d["id"]: [
            dict(r)
            for r in db.execute(
                "SELECT * FROM document_page_text WHERE document_id=? ORDER BY page_number",
                (d["id"],),
            )
        ]
        for d in documents
    }
    for key in keys:
        matches = []
        seen = set()
        errors = []
        for doc in documents:
            for page in source_pages[doc["id"]]:
                if page["error_message"] or not page["character_count"]:
                    errors.append(
                        "One or more selected pages have no usable text. Check Document Text before relying on a missing result."
                    )
                    continue
                try:
                    hits = search_page(page["text"], DEFINITIONS[key], RULES[key])
                except Exception:
                    LOG.exception("Deterministic search failed for a selected fact")
                    errors.append(
                        "This information could not be searched on one or more pages. Try again."
                    )
                    continue
                for hit in hits:
                    kind = "VALUE" if hit.value is not None else "RELATED_EVIDENCE"
                    signature = (
                        doc["id"],
                        page["page_number"],
                        kind,
                        json.dumps(hit.value),
                        hit.unit,
                        hit.evidence if kind == "RELATED_EVIDENCE" else "",
                    )
                    if signature in seen:
                        continue
                    seen.add(signature)
                    preference = RULES[key].get("preferred_document_types", [])
                    bonus = 5 if doc["document_type"] in preference else 0
                    matches.append(
                        dict(
                            id=str(uuid4()),
                            run_id=run_id,
                            machine_id=machine_id,
                            fact_key=key,
                            kind=kind,
                            candidate_value_json=(
                                json.dumps(hit.value, allow_nan=False)
                                if hit.value is not None
                                else None
                            ),
                            candidate_unit=hit.unit,
                            document_id=doc["id"],
                            page_number=page["page_number"],
                            evidence_text=hit.evidence,
                            match_method=hit.method,
                            match_score=hit.score + bonus,
                            status="PROPOSED",
                            created_at=started,
                            reviewed_at=None,
                        )
                    )
        count = sum(m["kind"] == "VALUE" for m in matches)
        state = (
            "MULTIPLE_CANDIDATES_FOUND"
            if count > 1
            else (
                "CANDIDATE_FOUND"
                if count
                else (
                    "RELATED_EVIDENCE_ONLY"
                    if matches
                    else "PROCESSING_ERROR" if errors else "NO_INFORMATION_FOUND"
                )
            )
        )
        messages = {
            "MULTIPLE_CANDIDATES_FOUND": "Review each source; no value has been chosen automatically.",
            "CANDIDATE_FOUND": "A candidate was found. Review its evidence before applying.",
            "RELATED_EVIDENCE_ONLY": "Related evidence found, but no direct value could be extracted safely.",
            "NO_INFORMATION_FOUND": "No matching information found in the selected documents.",
            "PROCESSING_ERROR": "No candidate could be established from the available pages.",
        }
        groups.append(
            dict(
                fact_key=key,
                display_name=DEFINITIONS[key]["display_name"],
                state=state,
                message=messages[state],
                warnings=list(dict.fromkeys(errors)),
            )
        )
        candidates.extend(matches)
    completed = timestamp()
    with db:
        db.execute(
            "INSERT INTO profile_search_runs VALUES (?,?,?,?,?,?,?,?)",
            (
                run_id,
                machine_id,
                json.dumps(keys),
                json.dumps(doc_ids),
                json.dumps(snapshots),
                json.dumps(groups),
                started,
                completed,
            ),
        )
        db.executemany(
            """INSERT INTO profile_candidates(id,run_id,machine_id,fact_key,kind,candidate_value_json,candidate_unit,document_id,page_number,evidence_text,match_method,match_score,status,created_at,reviewed_at)
            VALUES (:id,:run_id,:machine_id,:fact_key,:kind,:candidate_value_json,:candidate_unit,:document_id,:page_number,:evidence_text,:match_method,:match_score,:status,:created_at,:reviewed_at)""",
            candidates,
        )
    return get_run(db, machine_id, run_id)


def review_candidate(
    db, candidate_id: str, machine_id: str, action: str, expected_updated_at=None
):
    get_machine(db, machine_id)
    with db:
        # Lock before checking the current profile to avoid racing another edit or review.
        db.execute("BEGIN IMMEDIATE")
        row = db.execute(
            "SELECT * FROM profile_candidates WHERE id=? AND machine_id=?",
            (candidate_id, machine_id),
        ).fetchone()
        if row is None:
            fail("Candidate not found for this Machine.", 404)
        if row["status"] != "PROPOSED":
            fail("This candidate has already been applied or rejected.", 409)
        if action == "APPLIED":
            if row["kind"] != "VALUE":
                fail("Related evidence has no extracted value to apply.")
            machine = get_machine(db, machine_id)
            definition = DEFINITIONS[row["fact_key"]]
            if not applicable(definition, machine.machine_type) or definition.get(
                "machine_field"
            ):
                fail("This information no longer applies to this Machine.")
            document = get_document(db, row["document_id"])
            if document.machine_id != machine_id or document.status != "ACTIVE":
                fail(
                    "The source document must still be active and associated with this Machine."
                )
            existing = db.execute(
                "SELECT * FROM profile_facts WHERE machine_id=? AND fact_key=?",
                (machine_id, row["fact_key"]),
            ).fetchone()
            if (existing["updated_at"] if existing else None) != expected_updated_at:
                fail(
                    "The current profile value changed. Refresh the comparison and review it before applying.",
                    409,
                )
            data = FactInput(
                value=json.loads(row["candidate_value_json"]),
                unit=row["candidate_unit"],
                status="NEEDS_REVIEW",
                source_document_id=row["document_id"],
                source_location=f"{'PDF page' if document.file_type=='PDF' else 'Text section'} {row['page_number']}",
                engineering_notes=existing["engineering_notes"] if existing else "",
            )
            save_fact(db, machine_id, row["fact_key"], data, commit=False)
        db.execute(
            "UPDATE profile_candidates SET status=?,reviewed_at=? WHERE id=?",
            (action, timestamp(), candidate_id),
        )
    return dict(
        run=get_run(db, machine_id, row["run_id"]), profile=get_profile(db, machine_id)
    )
