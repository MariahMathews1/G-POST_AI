# Creo NC G-POST Companion V2

An engineering companion for NC programmers developing machine-specific Creo G-POST postprocessors. It will organize machine references, reviewed Machine Profiles, OFG guidance, custom FIL/CIMFIL requirements, and engineering handoff packages. It does not replace Creo, G-POST, OFG, or VERICUT.

Machine → Documents → Machine Profile → Post Record → OFG Settings → Custom Logic if needed → Review & Export → Official G-POST workflow

## Current Status

**Sprint 4A — Document processing foundation functional.**

Machines remain functional. Reference documents can now be uploaded, associated with one saved Machine, listed globally or under that Machine, viewed/downloaded, edited, archived, and restored. Dashboard counts active Machines and Documents. SQLite stores document metadata; `backend/data/documents/` stores original files.

Machine Profile now provides 43 configuration-driven definitions, live Machine identity, five collapsible categories, manual typed entry, document provenance, review decisions, and applicability-aware counts. Values persist in SQLite.

Document Detail now supports Prepare for Search / Reprocess, local native PDF text followed by per-page OCR only when needed, TXT/MD preparation, persistent one-based page text, and read-only page inspection. Original files remain unchanged.

There is no targeted fact extraction/search, Shop Knowledge data, Post management, OFG/FIL logic, ML, MATLAB, Azure, embeddings/RAG, exports, or authentication. Find Information remains disabled.

See the [V2 Blueprint](docs/V2_BLUEPRINT.md), [Sprint 1 guide](docs/sprints/SPRINT_001_MACHINES.md), [Sprint 2 guide](docs/sprints/SPRINT_002_DOCUMENTS.md), [Sprint 3 guide](docs/sprints/SPRINT_003_MACHINE_PROFILE.md), and [Sprint 4A guide](docs/sprints/SPRINT_004A_DOCUMENT_PROCESSING.md).

## Run locally

Use Python 3.12+ with [uv](https://docs.astral.sh/uv/), and Node.js 22.12+, 24.x, or 26+ with npm. From the repository root, start two terminals:

**Backend**

```sh
uv sync --directory backend
uv run --directory backend uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

**Frontend**

```sh
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Its `/api` proxy connects to the backend at `127.0.0.1:8010`. The backend creates `backend/data/companion.sqlite3` automatically and applies outstanding migrations once while preserving existing Machines. No seed records are created on startup. Set `COMPANION_DB_PATH` to use a different database file. Document storage defaults to a `documents/` folder beside that file; `COMPANION_DOCUMENTS_DIR` can override it. The upload limit defaults to 25 MB and is configured once with `COMPANION_MAX_UPLOAD_MB`; the upload form reads it from the backend.

`/machines/demo` remains a labeled, unsaved UI example; it cannot be edited or archived and never contributes to counts. `/posts/demo` remains a static Post example. Use **Add Machine** for real saved records and **Upload Document** for their references. PDF, TXT, and MD are accepted. Local OCR additionally requires Tesseract on PATH with the configured language data; native-text documents work without it. See the Sprint 4A guide for setup and processing settings.

## Verify

```sh
uv run --directory backend pytest
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

Backend feature code lives in `backend/app/machines/`, `backend/app/documents/`, and `backend/app/machine_profiles/`; matching frontend screens live in `frontend/src/features/`. Sprint guides explain the files, data flow, APIs, and manual acceptance steps. Sprint 4A stops at page-aware text preparation; profile fact search remains future work.

Framework references: [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/), [Vite setup](https://vite.dev/guide/), and [React Router routing](https://reactrouter.com/start/declarative/routing).
