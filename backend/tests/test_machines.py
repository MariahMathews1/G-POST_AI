import sqlite3
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

DATA = {
    "name": "KLS-1840N Demo", "manufacturer": "KENT", "model": "KLS-1840N",
    "machine_type": "Lathe", "controller": "FANUC 0i-TF", "notes": "V2 demo machine",
}


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "machines.sqlite3")) as client:
        yield client


def create(client):
    response = client.post("/api/machines", json=DATA)
    assert response.status_code == 201
    return response.json()


def test_create_and_trim(client):
    data = {key: f"  {value}  " for key, value in DATA.items()}
    response = client.post("/api/machines", json=data)
    assert response.status_code == 201
    machine = response.json()
    assert all(machine[key] == value for key, value in DATA.items())
    assert machine["status"] == "ACTIVE"
    assert machine["id"]
    assert machine["created_at"] == machine["updated_at"]


def test_list_and_status_filter(client):
    assert client.get("/api/machines").json() == []
    machine = create(client)
    assert client.get("/api/machines?status=ACTIVE").json() == [machine]
    client.post(f"/api/machines/{machine['id']}/archive")
    assert client.get("/api/machines?status=ACTIVE").json() == []
    assert len(client.get("/api/machines?status=ARCHIVED").json()) == 1
    assert len(client.get("/api/machines").json()) == 1


def test_get(client):
    machine = create(client)
    assert client.get(f"/api/machines/{machine['id']}").json() == machine


def test_edit(client):
    machine = create(client)
    response = client.put(f"/api/machines/{machine['id']}", json={**DATA, "controller": " FANUC 0i-TF Plus "})
    assert response.status_code == 200
    edited = response.json()
    assert edited["controller"] == "FANUC 0i-TF Plus"
    assert edited["created_at"] == machine["created_at"]
    assert edited["updated_at"] > machine["updated_at"]
    assert edited["status"] == "ACTIVE"


def test_archive(client):
    machine = create(client)
    response = client.post(f"/api/machines/{machine['id']}/archive")
    assert response.status_code == 200
    assert response.json()["status"] == "ARCHIVED"
    assert client.get(f"/api/machines/{machine['id']}").status_code == 200


def test_restore(client):
    machine = create(client)
    client.post(f"/api/machines/{machine['id']}/archive")
    response = client.post(f"/api/machines/{machine['id']}/restore")
    assert response.status_code == 200
    assert response.json()["status"] == "ACTIVE"


@pytest.mark.parametrize("field", ["name", "manufacturer", "model", "machine_type", "controller"])
@pytest.mark.parametrize("invalid", ["", "   ", None])
def test_required_values(client, field, invalid):
    assert client.post("/api/machines", json={**DATA, field: invalid}).status_code == 422
    machine = create(client)
    assert client.put(f"/api/machines/{machine['id']}", json={**DATA, field: invalid}).status_code == 422
    assert client.get(f"/api/machines/{machine['id']}").json()[field] == DATA[field]


@pytest.mark.parametrize("field", ["name", "manufacturer", "model", "machine_type", "controller"])
def test_missing_required_field(client, field):
    data = DATA.copy()
    del data[field]
    assert client.post("/api/machines", json=data).status_code == 422


@pytest.mark.parametrize("machine_type", ["Lathe", "Mill", "Mill-Turn", "Swiss", "Other"])
def test_allowed_machine_types(client, machine_type):
    assert client.post("/api/machines", json={**DATA, "machine_type": machine_type}).status_code == 201


def test_invalid_type_and_status(client):
    assert client.post("/api/machines", json={**DATA, "machine_type": "Unlisted"}).status_code == 422
    assert client.post("/api/machines", json={**DATA, "status": "DELETED"}).status_code == 422
    assert client.get("/api/machines?status=DELETED").status_code == 422


def test_notes_optional(client):
    data = DATA.copy()
    del data["notes"]
    assert client.post("/api/machines", json=data).json()["notes"] == ""


@pytest.mark.parametrize("method,suffix", [("get", ""), ("put", ""), ("post", "/archive"), ("post", "/restore")])
def test_not_found(client, method, suffix):
    options = {"json": DATA} if method == "put" else {}
    response = getattr(client, method)(f"/api/machines/missing{suffix}", **options)
    assert response.status_code == 404
    assert response.json()["detail"] == "Machine not found."


def test_update_cannot_change_status_or_identity(client):
    machine = create(client)
    for key, value in [("id", "changed"), ("status", "ARCHIVED"), ("created_at", "changed")]:
        assert client.put(f"/api/machines/{machine['id']}", json={**DATA, key: value}).status_code == 422


def test_startup_migration_and_restart_persistence(tmp_path):
    path = tmp_path / "nested" / "machines.sqlite3"
    with TestClient(create_app(path)) as client:
        machine = create(client)
        client.put(f"/api/machines/{machine['id']}", json={**DATA, "controller": "FANUC 0i-TF Plus"})
        client.post(f"/api/machines/{machine['id']}/archive")
    with TestClient(create_app(path)) as client:
        persisted = client.get(f"/api/machines/{machine['id']}").json()
        assert persisted["controller"] == "FANUC 0i-TF Plus"
        assert persisted["status"] == "ARCHIVED"
        assert persisted["created_at"] == machine["created_at"]
        client.post(f"/api/machines/{machine['id']}/restore")
    with TestClient(create_app(path)) as client:
        assert client.get("/api/machines?status=ACTIVE").json()[0]["id"] == machine["id"]
    with sqlite3.connect(path) as db:
        assert db.execute("PRAGMA user_version").fetchone()[0] == 7
        assert db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall() == [("machines",), ("documents",), ("profile_facts",), ("document_processing",), ("document_page_text",), ("profile_search_runs",), ("profile_candidates",)]
        assert db.execute("SELECT count(*) FROM machines").fetchone()[0] == 1
