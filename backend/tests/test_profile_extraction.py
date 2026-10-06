import sqlite3
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.core.database import connect
from app.profile_extraction import service
from app.profile_extraction.rules import RULES
from app.profile_extraction.search import search_page
from app.machine_profiles.catalog import DEFINITIONS

MACHINE = dict(
    name="Extraction test",
    manufacturer="Test",
    model="Model",
    machine_type="Lathe",
    controller="Controller",
    notes="",
)


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "extraction.sqlite3")) as client:
        yield client


def machine(c, kind="Lathe"):
    return c.post("/api/machines", json={**MACHINE, "machine_type": kind}).json()["id"]


def document(c, mid, text, kind="MACHINE_MANUAL", prepare=True):
    response = c.post(
        "/api/documents",
        data=dict(machine_id=mid, title="Safe test manual", document_type=kind),
        files={"file": ("reference.txt", text.encode(), "text/plain")},
    )
    assert response.status_code == 201
    d = response.json()
    if prepare:
        assert c.post(f"/api/documents/{d['id']}/process").json()["state"] == "READY"
    return d["id"]


def find(c, mid, docs, keys=None):
    response = c.post(
        f"/api/machines/{mid}/profile/find-information",
        json=dict(fact_keys=keys or ["maximum_spindle_speed"], document_ids=docs),
    )
    assert response.status_code == 200, response.text
    return response.json()


def value_candidates(run):
    return [
        cand
        for group in run["results"]
        for cand in group["candidates"]
        if cand["kind"] == "VALUE"
    ]


def apply(c, mid, cand):
    profile = c.get(f"/api/machines/{mid}/profile").json()
    fact = next(
        f for f in profile["facts"] if f["definition"]["key"] == cand["fact_key"]
    )
    return c.post(
        f"/api/profile-candidates/{cand['id']}/apply",
        json=dict(machine_id=mid, expected_profile_updated_at=fact["updated_at"]),
    )


def fact(c, mid, key="maximum_spindle_speed"):
    return next(
        f
        for f in c.get(f"/api/machines/{mid}/profile").json()["facts"]
        if f["definition"]["key"] == key
    )


def test_selected_fact_and_immutable_profile(client):
    mid = machine(client)
    did = document(client, mid, "Intro\nMaximum spindle speed .... 4,000 rev/min\nEnd")
    before = client.get(f"/api/machines/{mid}/profile").json()
    run = find(client, mid, [did])
    assert run["selected_fact_keys"] == ["maximum_spindle_speed"] and run[
        "selected_document_ids"
    ] == [did]
    assert run["results"][0]["state"] == "CANDIDATE_FOUND"
    cand = value_candidates(run)[0]
    assert cand["candidate_value"] == 4000 and cand["candidate_unit"] == "rpm"
    assert (
        cand["status"] == "PROPOSED"
        and cand["page_number"] == 1
        and cand["document_id"] == did
    )
    assert (
        "Intro\nMaximum spindle speed" in cand["evidence_text"]
        and "\nEnd" in cand["evidence_text"]
    )
    assert "match_score" not in cand and "candidate_value_json" not in cand
    assert client.get(f"/api/machines/{mid}/profile").json() == before
    assert (
        client.get(f"/api/machines/{mid}/profile/candidates?run_id={run['id']}").json()
        == run
    )


def test_multiple_facts_documents_and_rank(client):
    mid = machine(client)
    controller = document(
        client,
        mid,
        "Maximum spindle speed: 6000 rpm\nMaximum feedrate: 500 IPM",
        "CONTROLLER_MANUAL",
    )
    physical = document(
        client, mid, "Maximum spindle speed: 4000 rpm\nMaximum feedrate: 12,000 mm/min"
    )
    run = find(
        client,
        mid,
        [controller, physical],
        ["maximum_spindle_speed", "maximum_feedrate"],
    )
    assert [g["state"] for g in run["results"]] == ["MULTIPLE_CANDIDATES_FOUND"] * 2
    assert [c["candidate_value"] for c in run["results"][0]["candidates"]] == [
        4000,
        6000,
    ]
    assert len(value_candidates(run)) == 4
    assert fact(client, mid)["status"] == "MISSING"


@pytest.mark.parametrize(
    "key,line,value,unit",
    [
        ("maximum_spindle_speed", "Maximum spindle speed: 4000 RPM", 4000, "rpm"),
        ("maximum_spindle_speed", "max-spindle-speed (rpm): 4,000", 4000, "rpm"),
        ("maximum_spindle_speed", "Maximum spindle rpm: 4000 min^-1", 4000, "rpm"),
        ("maximum_spindle_speed", "Maximum spindle rpm: 4000 min⁻¹", 4000, "rpm"),
        ("maximum_spindle_speed", "Spindle speed range: 50–4000 rev/min", 4000, "rpm"),
        ("maximum_feedrate", "Maximum feed rate: 500 inches per minute", 500, "in/min"),
        ("x_minimum", "X axis minimum: −11 inches", -11, "in"),
        ("x_maximum", "X maximum: 120 millimetres", 120, "mm"),
        ("z_minimum", "Z min .... -12.500 in", -12.5, "in"),
        ("programming_units", "Programming units: metric / inches", "Both", None),
        ("programming_units", "Program units: inch", "Imperial", None),
        ("controlled_axes", "Number of controlled axes: 2", 2, None),
        ("linear_axes", "Linear axes: X, Z", ["X", "Z"], None),
        ("linear_axes", "Linear axes: X and Z", ["X", "Z"], None),
        (
            "axis_configuration",
            "Axis configuration: X/Z controlled axes",
            "X/Z controlled axes",
            None,
        ),
        (
            "controller_version",
            "Controller series: FANUC 0i-TF Plus",
            "FANUC 0i-TF Plus",
            None,
        ),
        ("maximum_spindle_speed", "Maximum spindle\nspeed\n4000 rpm", 4000, "rpm"),
    ],
)
def test_normalization_rules(client, key, line, value, unit):
    mid = machine(client)
    did = document(client, mid, line)
    run = find(client, mid, [did], [key])
    cand = value_candidates(run)[0]
    assert cand["candidate_value"] == value and cand["candidate_unit"] == unit
    assert line in cand["evidence_text"]


@pytest.mark.parametrize(
    "line",
    [
        "X travel = 20 in",
        "X stroke: 500 mm",
        "X axis minimum: -11",
        "X minimum: 0 to 20 in",
        "X minimum information not specified",
    ],
)
def test_related_evidence_without_fabricated_axis_limits(client, line):
    mid = machine(client)
    did = document(client, mid, line)
    run = find(client, mid, [did], ["x_minimum"])
    assert (
        not value_candidates(run)
        and run["results"][0]["state"] == "RELATED_EVIDENCE_ONLY"
    )
    cand = run["results"][0]["candidates"][0]
    assert cand["candidate_value"] is None
    assert apply(client, mid, cand).status_code == 422
    assert fact(client, mid, "x_minimum")["status"] == "MISSING"


@pytest.mark.parametrize(
    "line",
    [
        "Maximum spindle speed: 4000",
        "Maximum spindle speed: 4,5 rpm",
        "Maximum spindle speed: 4000 rpm or 6000 rpm",
        "Maximum spindle speed: 4000 rpm to 6000 rpm",
        "Maximum spindle speed (rpm):4000 mm",
        "Number of controlled axes: 0",
        "Controller series: Maximum spindle speed: 4000 RPM",
    ],
)
def test_ambiguous_values_are_related_only(client, line):
    key = (
        "controlled_axes"
        if line.startswith("Number")
        else (
            "controller_version"
            if line.startswith("Controller")
            else "maximum_spindle_speed"
        )
    )
    mid = machine(client)
    did = document(client, mid, line)
    run = find(client, mid, [did], [key])
    assert (
        not value_candidates(run)
        and run["results"][0]["state"] == "RELATED_EVIDENCE_ONLY"
    )


def test_no_information_and_incomplete_sources(client):
    mid = machine(client)
    did = document(client, mid, "General machine reference without this information.")
    run = find(client, mid, [did])
    assert (
        run["results"][0]["state"] == "NO_INFORMATION_FOUND"
        and run["results"][0]["candidates"] == []
    )
    with connect(client.app.state.database_path) as db:
        db.execute(
            "UPDATE document_processing SET state='PARTIAL' WHERE document_id=?", (did,)
        )
        db.execute(
            "INSERT INTO document_page_text VALUES ('failed',?,2,'','OCR',0,'OCR unavailable','date','date')",
            (did,),
        )
    run = find(client, mid, [did])
    assert (
        run["results"][0]["state"] == "PROCESSING_ERROR"
        and run["results"][0]["warnings"]
    )


def test_apply_requires_explicit_action_and_defaults_to_review(client):
    mid = machine(client)
    did = document(client, mid, "Maximum spindle speed:4000rpm")
    client.put(
        f"/api/machines/{mid}/profile/facts/maximum_spindle_speed",
        json=dict(
            value=3500,
            unit="rpm",
            status="CONFIRMED",
            engineering_notes="Prior engineering note",
        ),
    )
    cand = value_candidates(find(client, mid, [did]))[0]
    assert (
        fact(client, mid)["value"] == 3500
        and fact(client, mid)["status"] == "CONFIRMED"
    )
    response = apply(client, mid, cand)
    assert response.status_code == 200
    f = fact(client, mid)
    assert (f["value"], f["unit"], f["status"]) == (4000, "rpm", "NEEDS_REVIEW")
    assert (
        f["source_type"] == "DOCUMENT_REFERENCE"
        and f["source_document_id"] == did
        and f["source_location"] == "Text section 1"
    )
    assert f["engineering_notes"] == "Prior engineering note"
    saved = value_candidates(response.json()["run"])[0]
    assert (
        saved["status"] == "APPLIED"
        and saved["reviewed_at"]
        and saved["evidence_text"] == cand["evidence_text"]
    )
    client.put(
        f"/api/machines/{mid}/profile/facts/maximum_spindle_speed",
        json=dict(
            value=4000,
            unit="rpm",
            status="CONFIRMED",
            source_document_id=did,
            source_location="Text section 1",
        ),
    )
    assert (
        apply(client, mid, cand).status_code == 409
        and fact(client, mid)["status"] == "CONFIRMED"
    )


def test_reject_is_traceable_and_never_changes_profile(client):
    mid = machine(client)
    did = document(client, mid, "Maximum spindle speed:4000 rpm")
    cand = value_candidates(find(client, mid, [did]))[0]
    before = fact(client, mid)
    response = client.post(
        f"/api/profile-candidates/{cand['id']}/reject", json=dict(machine_id=mid)
    )
    assert (
        response.status_code == 200
        and value_candidates(response.json()["run"])[0]["status"] == "REJECTED"
    )
    assert fact(client, mid) == before and apply(client, mid, cand).status_code == 409


def test_stale_comparison_and_ownership(client):
    mid = machine(client)
    other = machine(client)
    did = document(client, mid, "Maximum spindle speed:4000 rpm")
    cand = value_candidates(find(client, mid, [did]))[0]
    assert apply(client, other, cand).status_code == 404
    client.put(
        f"/api/machines/{mid}/profile/facts/maximum_spindle_speed",
        json=dict(value=3600, unit="rpm"),
    )
    response = client.post(
        f"/api/profile-candidates/{cand['id']}/apply",
        json=dict(machine_id=mid, expected_profile_updated_at=None),
    )
    assert response.status_code == 409 and fact(client, mid)["value"] == 3600
    client.post(f"/api/documents/{did}/archive")
    assert apply(client, mid, cand).status_code == 422


@pytest.mark.parametrize(
    "invalid", ["foreign", "archived", "unprepared", "failed", "processing"]
)
def test_source_eligibility(client, invalid):
    mid = machine(client)
    other = machine(client)
    did = document(
        client,
        other if invalid == "foreign" else mid,
        "Maximum spindle speed:4000 rpm",
        prepare=invalid != "unprepared",
    )
    if invalid == "archived":
        client.post(f"/api/documents/{did}/archive")
    if invalid in ["failed", "processing"]:
        with connect(client.app.state.database_path) as db:
            db.execute(
                "UPDATE document_processing SET state=? WHERE document_id=?",
                (invalid.upper(), did),
            )
    assert client.get(f"/api/machines/{mid}/profile/extraction-documents").json() == []
    assert (
        client.post(
            f"/api/machines/{mid}/profile/find-information",
            json=dict(fact_keys=["maximum_spindle_speed"], document_ids=[did]),
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "keys",
    [
        [],
        ["machine_manufacturer"],
        ["y_minimum"],
        ["tool_change"],
        ["supported_g_codes"],
        ["unknown"],
    ],
)
def test_fact_eligibility(client, keys):
    mid = machine(client)
    did = document(client, mid, "Reference fixture")
    assert (
        client.post(
            f"/api/machines/{mid}/profile/find-information",
            json=dict(fact_keys=keys, document_ids=[did]),
        ).status_code
        == 422
    )


def test_deduplication_and_separate_runs(client):
    mid = machine(client)
    did = document(
        client, mid, "Maximum spindle speed: 4000 rpm\nMaximum spindle speed: 4000 rpm"
    )
    first = find(
        client, mid, [did, did], ["maximum_spindle_speed", "maximum_spindle_speed"]
    )
    second = find(client, mid, [did])
    assert (
        len(value_candidates(first)) == len(value_candidates(second)) == 1
        and first["id"] != second["id"]
    )
    assert (
        client.get(f"/api/machines/{mid}/profile/candidates").json()["id"]
        == second["id"]
    )
    other = machine(client)
    assert (
        client.get(
            f"/api/machines/{other}/profile/candidates?run_id={first['id']}"
        ).status_code
        == 404
    )


def test_pdf_page_provenance_and_persistence(tmp_path):
    path = tmp_path / "persist.sqlite3"
    with TestClient(create_app(path)) as c:
        mid = machine(c)
        fixture = Path(__file__).parent / "fixtures/targeted_reference.pdf"
        d = c.post(
            "/api/documents",
            data=dict(
                machine_id=mid,
                title="Two-page safe PDF",
                document_type="MACHINE_MANUAL",
            ),
            files={"file": ("reference.pdf", fixture.read_bytes(), "application/pdf")},
        ).json()
        c.post(f"/api/documents/{d['id']}/process")
        cand = value_candidates(find(c, mid, [d["id"]]))[0]
        assert cand["page_number"] == 2 and cand["file_type"] == "PDF"
        assert (
            cand["candidate_value"] == 4000 and "4,000 min^-1" in cand["evidence_text"]
        )
        response = apply(c, mid, cand)
        assert (
            response.status_code == 200
            and fact(c, mid)["source_location"] == "PDF page 2"
        )
        run = response.json()["run"]
    with TestClient(create_app(path)) as c:
        assert (
            c.get(f"/api/machines/{mid}/profile/candidates?run_id={run['id']}").json()
            == run
        )
        assert fact(c, mid)["status"] == "NEEDS_REVIEW"


def test_atomic_apply_rollback(client, monkeypatch):
    mid = machine(client)
    did = document(client, mid, "Maximum spindle speed:4000 rpm")
    cand = value_candidates(find(client, mid, [did]))[0]
    original = service.save_fact

    def fail_after_write(*args, **kwargs):
        original(*args, **kwargs)
        raise sqlite3.IntegrityError("test rollback")

    monkeypatch.setattr(service, "save_fact", fail_after_write)
    assert apply(client, mid, cand).status_code == 503
    assert fact(client, mid)["status"] == "MISSING"
    run = client.get(f"/api/machines/{mid}/profile/candidates").json()
    assert value_candidates(run)[0]["status"] == "PROPOSED"


def test_rule_subset_and_direct_axis_range_safety():
    assert len(RULES) == 13
    assert all(DEFINITIONS[key]["extraction"]["eligible"] for key in RULES)
    hits = search_page("X travel = 20 in", DEFINITIONS["x_minimum"], RULES["x_minimum"])
    assert hits and all(h.value is None for h in hits)
