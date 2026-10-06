import sqlite3
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.core.database import connect
from app.documents.storage import stored_path
from app.documents.models import DocumentError

MACHINE = {"name": "KLS-1840N Demo", "manufacturer": "KENT", "model": "KLS-1840N", "machine_type": "Lathe", "controller": "FANUC 0i-TF", "notes": ""}
PDF = b"%PDF-1.4\n%machine reference fixture\n%%EOF\n"


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / "companion.sqlite3")) as client:
        yield client


@pytest.fixture
def machine(client):
    return client.post("/api/machines", json=MACHINE).json()


def upload(client, machine, name="manual.pdf", content=PDF, mime="application/pdf", **metadata):
    data = {"machine_id": machine["id"], "title": "KLS Machine Manual", "document_type": "MACHINE_MANUAL", "description": "Machine reference manual used for V2 development.", **metadata}
    return client.post("/api/documents", data=data, files={"file": (name, content, mime)})


@pytest.mark.parametrize("name,content,mime,file_type", [("manual.pdf", PDF, "application/pdf", "PDF"), ("reference.txt", b"Machine reference", "text/plain", "TXT"), ("reference.md", b"# Machine reference", "text/markdown", "MD")])
def test_upload_allowed_files(client, machine, name, content, mime, file_type):
    response = upload(client, machine, name, content, mime)
    assert response.status_code == 201
    document = response.json()
    assert document["machine_id"] == machine["id"]
    assert document["machine_name"] == machine["name"]
    assert document["original_filename"] == name
    assert document["storage_key"] != name
    assert document["file_type"] == file_type
    assert document["file_size"] == len(content)
    assert document["status"] == "ACTIVE"
    assert document["created_at"] == document["updated_at"]
    assert (client.app.state.document_storage / document["storage_key"]).read_bytes() == content


@pytest.mark.parametrize("extension", ["nc", "ncl", "cl", "acl", "apt", "tap", "gcode", "cad", "step", "stp", "iges", "igs", "toolpath", "exe", "html"])
def test_reject_unsupported_extensions(client, machine, extension):
    response = upload(client, machine, f"reference.{extension}", b"data", "application/octet-stream")
    assert response.status_code == 415
    assert "PDF, TXT, or MD" in response.json()["detail"]
    assert client.get("/api/documents").json() == []
    assert list(client.app.state.document_storage.iterdir()) == []


@pytest.mark.parametrize("name,mime", [("file.pdf", "text/html"), ("file.txt", "application/pdf"), ("file.md", "text/html")])
def test_reject_mismatched_mime(client, machine, name, mime):
    assert upload(client, machine, name, PDF, mime).status_code == 415


def test_reject_invalid_pdf_header_without_parsing(client, machine):
    assert upload(client, machine, content=b"not a PDF").status_code == 415
    assert list(client.app.state.document_storage.iterdir()) == []


@pytest.mark.parametrize("name,mime", [("file.pdf", "application/pdf"), ("file.txt", "text/plain"), ("file.md", "text/markdown")])
def test_reject_empty_files(client, machine, name, mime):
    response = upload(client, machine, name, b"", mime)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"]
    assert list(client.app.state.document_storage.iterdir()) == []


def test_upload_limit_and_partial_file_cleanup(tmp_path):
    with TestClient(create_app(tmp_path / "limit.sqlite3", max_file_size=10)) as client:
        machine = client.post("/api/machines", json=MACHINE).json()
        assert upload(client, machine, "file.txt", b"12345678901", "text/plain").status_code == 413
        assert client.get("/api/documents").json() == []
        assert list(client.app.state.document_storage.iterdir()) == []
        assert upload(client, machine, "file.txt", b"1234567890", "text/plain").status_code == 201
        assert client.get("/api/documents/upload-options").json() == {"allowed_extensions": [".pdf", ".txt", ".md"], "max_file_size": 10}


@pytest.mark.parametrize("field", ["machine_id", "title", "document_type"])
def test_required_upload_metadata(client, machine, field):
    data = {"machine_id": machine["id"], "title": "Manual", "document_type": "MACHINE_MANUAL"}
    del data[field]
    assert client.post("/api/documents", data=data, files={"file": ("manual.pdf", PDF, "application/pdf")}).status_code == 422
    assert list(client.app.state.document_storage.iterdir()) == []


def test_require_file_and_valid_machine(client, machine):
    assert client.post("/api/documents", data={"machine_id": machine["id"], "title": "Manual", "document_type": "MACHINE_MANUAL"}).status_code == 422
    assert upload(client, {"id": "missing"}).status_code == 404
    assert list(client.app.state.document_storage.iterdir()) == []


def test_trim_title_and_description(client, machine):
    document = upload(client, machine, title="  Manual  ", description="  Notes  ").json()
    assert document["title"] == "Manual"
    assert document["description"] == "Notes"
    assert upload(client, machine, title="   ").status_code == 422


def test_all_document_types_and_invalid_type(client, machine):
    types = ["MACHINE_MANUAL", "CONTROLLER_MANUAL", "PROGRAMMING_MANUAL", "SPECIFICATION_SHEET", "GPOST_OFG_REFERENCE", "APPROVED_INTERNAL_REFERENCE", "OTHER"]
    for value in types:
        assert upload(client, machine, document_type=value).status_code == 201
    assert upload(client, machine, document_type="AI_REFERENCE").status_code == 422


def test_list_filter_get_and_machine_rename(client, machine):
    other = client.post("/api/machines", json={**MACHINE, "name": "Another Machine"}).json()
    first = upload(client, machine).json()
    second = upload(client, other, document_type="CONTROLLER_MANUAL").json()
    assert len(client.get("/api/documents").json()) == 2
    assert client.get(f"/api/documents?machine_id={machine['id']}").json() == [first]
    assert client.get("/api/documents?document_type=CONTROLLER_MANUAL").json() == [second]
    assert client.get(f"/api/documents/{first['id']}").json() == first
    client.put(f"/api/machines/{machine['id']}", json={**MACHINE, "name": "Renamed"})
    assert client.get(f"/api/documents/{first['id']}").json()["machine_name"] == "Renamed"


def test_metadata_edit_does_not_replace_original_or_machine(client, machine):
    document = upload(client, machine).json()
    response = client.patch(f"/api/documents/{document['id']}", json={"title": " Updated manual ", "document_type": "OTHER", "description": " Updated notes "})
    assert response.status_code == 200
    edited = response.json()
    assert edited["title"] == "Updated manual"
    assert edited["description"] == "Updated notes"
    assert edited["document_type"] == "OTHER"
    for field in ["machine_id", "storage_key", "original_filename", "file_type", "file_size", "created_at", "status"]:
        assert edited[field] == document[field]
    assert edited["updated_at"] > document["updated_at"]
    assert client.get(f"/api/documents/{document['id']}/file").content == PDF
    assert client.patch(f"/api/documents/{document['id']}", json={"description": ""}).json()["description"] == ""


@pytest.mark.parametrize("invalid", [{"title": "   "}, {"title": None}, {"description": None}, {"document_type": "INVALID"}, {"machine_id": "changed"}, {"storage_key": "changed.pdf"}, {"file": "changed"}, {"status": "ARCHIVED"}, {}])
def test_invalid_or_immutable_metadata(client, machine, invalid):
    document = upload(client, machine).json()
    assert client.patch(f"/api/documents/{document['id']}", json=invalid).status_code == 422
    assert client.get(f"/api/documents/{document['id']}").json() == document


def test_archive_restore_retains_file_and_machine(client, machine):
    document = upload(client, machine).json()
    id = document["id"]
    assert client.post(f"/api/documents/{id}/archive").json()["status"] == "ARCHIVED"
    assert client.get("/api/documents?status=ACTIVE").json() == []
    assert client.get("/api/documents?status=ARCHIVED").json()[0]["id"] == id
    assert client.get(f"/api/documents?machine_id={machine['id']}&status=ARCHIVED&document_type=MACHINE_MANUAL").json()[0]["id"] == id
    assert client.get(f"/api/documents/{id}/file?download=true").content == PDF
    assert client.post(f"/api/documents/{id}/restore").json()["status"] == "ACTIVE"
    assert client.get("/api/documents?status=ACTIVE").json()[0]["id"] == id
    client.post(f"/api/machines/{machine['id']}/archive")
    assert client.get(f"/api/documents/{id}").json()["status"] == "ACTIVE"


@pytest.mark.parametrize("name,content,mime", [("manual.pdf", PDF, "application/pdf"), ("notes.txt", b"<script>text only</script>", "text/plain"), ("notes.md", b"# raw markdown", "text/markdown")])
def test_view_download_original_bytes_and_headers(client, machine, name, content, mime):
    document = upload(client, machine, name, content, mime).json()
    view = client.get(f"/api/documents/{document['id']}/file")
    download = client.get(f"/api/documents/{document['id']}/file?download=true")
    assert view.status_code == download.status_code == 200
    assert view.content == download.content == content
    assert view.headers["content-disposition"].startswith("inline;")
    assert download.headers["content-disposition"].startswith("attachment;")
    assert name in download.headers["content-disposition"]
    assert view.headers["x-content-type-options"] == "nosniff"
    assert view.headers["content-type"].startswith("application/pdf" if name.endswith(".pdf") else "text/plain")


def test_missing_stored_file_metadata_remains(client, machine):
    document = upload(client, machine).json()
    (client.app.state.document_storage / document["storage_key"]).unlink()
    response = client.get(f"/api/documents/{document['id']}/file")
    assert response.status_code == 404
    assert "missing from storage" in response.text
    assert response.headers["content-type"].startswith("text/plain")
    assert client.get(f"/api/documents/{document['id']}").status_code == 200


@pytest.mark.parametrize("method,suffix", [("get", ""), ("patch", ""), ("get", "/file"), ("post", "/archive"), ("post", "/restore")])
def test_document_not_found(client, method, suffix):
    options = {"json": {"title": "Updated"}} if method == "patch" else {}
    response = getattr(client, method)(f"/api/documents/missing{suffix}", **options)
    assert response.status_code == 404
    assert response.text == "Document not found." if suffix == "/file" else response.json()["detail"] == "Document not found."


def test_same_filename_unique_keys_and_safe_basename(client, machine):
    first = upload(client, machine, "../../manual.pdf").json()
    second = upload(client, machine, "manual.pdf").json()
    assert first["original_filename"] == second["original_filename"] == "manual.pdf"
    assert first["storage_key"] != second["storage_key"]
    assert len(list(client.app.state.document_storage.iterdir())) == 2
    with pytest.raises(DocumentError):
        stored_path(client.app.state.document_storage, "../outside.pdf")


def test_symlink_cannot_escape_storage(client, machine, tmp_path):
    document = upload(client, machine).json()
    path = client.app.state.document_storage / document["storage_key"]
    path.unlink()
    outside = tmp_path / "outside.pdf"
    outside.write_bytes(PDF)
    path.symlink_to(outside)
    assert client.get(f"/api/documents/{document['id']}/file").status_code == 404


def test_metadata_failure_removes_uploaded_file(client, machine):
    with sqlite3.connect(client.app.state.database_path) as db:
        db.execute("CREATE TRIGGER reject_document BEFORE INSERT ON documents BEGIN SELECT RAISE(ABORT, 'test failure'); END;")
    assert upload(client, machine).status_code == 503
    assert list(client.app.state.document_storage.iterdir()) == []
    assert client.get("/api/documents").json() == []


def test_migration_from_sprint_1_and_persistence(tmp_path):
    path = tmp_path / "existing.sqlite3"
    with sqlite3.connect(path) as db:
        db.execute((Path(__file__).parents[1] / "migrations" / "001_create_machines.sql").read_text())
        db.execute("PRAGMA user_version=1")
        db.execute("INSERT INTO machines VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", ("existing", "Existing Machine", "KENT", "KLS", "Lathe", "FANUC", "", "ACTIVE", "2026-10-06T00:00:00Z", "2026-10-06T00:00:00Z"))
    with TestClient(create_app(path)) as client:
        assert client.get("/api/machines/existing").json()["name"] == "Existing Machine"
        document = upload(client, {"id": "existing"}).json()
        client.patch(f"/api/documents/{document['id']}", json={"title": "Persistent title"})
        client.post(f"/api/documents/{document['id']}/archive")
    with TestClient(create_app(path)) as client:
        persisted = client.get(f"/api/documents/{document['id']}").json()
        assert persisted["title"] == "Persistent title"
        assert persisted["status"] == "ARCHIVED"
        assert client.get(f"/api/documents/{document['id']}/file").content == PDF
    with connect(path) as db:
        assert db.execute("PRAGMA user_version").fetchone()[0] == 7
        assert [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")] == ["machines", "documents", "profile_facts", "document_processing", "document_page_text", "profile_search_runs", "profile_candidates"]
        assert db.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        with pytest.raises(sqlite3.IntegrityError):
            db.execute("DELETE FROM machines WHERE id='existing'")
