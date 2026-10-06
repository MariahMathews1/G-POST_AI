# Creo NC G-POST Companion V2

An engineering companion for NC programmers developing machine-specific Creo G-POST postprocessors. It will organize machine references, reviewed Machine Profiles, OFG guidance, custom FIL/CIMFIL requirements, and engineering handoff packages. It does not replace Creo, G-POST, OFG, or VERICUT.

Machine → Documents → Machine Profile → Post Record → OFG Settings → Custom Logic if needed → Review & Export → Official G-POST workflow

## Current Status

**Sprint 1 — Machines functional.**

Machines can be created, listed, opened, edited, archived, and restored. SQLite preserves records across refresh and backend restart. Dashboard counts active machines. All other areas remain static placeholders: no document uploads, Machine Profile or Shop Knowledge data, Posts, OFG/FIL logic, extraction, ML, MATLAB, Azure, evidence packets, exports, or authentication.

See the [V2 Blueprint](docs/V2_BLUEPRINT.md) and [Sprint 1 guide](docs/sprints/SPRINT_001_MACHINES.md).

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

Open the URL printed by Vite (normally `http://localhost:5173`). Its `/api` proxy connects to the backend at `127.0.0.1:8010`. The backend creates `backend/data/companion.sqlite3` automatically and applies the initial migration once. No seed records are created on startup. Set `COMPANION_DB_PATH` to use a different database file.

`/machines/demo` remains a labeled, unsaved UI example; it cannot be edited or archived and never contributes to counts. `/posts/demo` remains a static Post example. Use **Add Machine** for real saved records.

## Verify

```sh
uv run --directory backend pytest
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

Backend code lives in `backend/app/machines/`; frontend machine screens live in `frontend/src/features/machines/`. The sprint guide explains the files, data flow, API, and manual acceptance steps. The next recommended sprint is Documents, after a separately agreed scope.

Framework references: [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/), [Vite setup](https://vite.dev/guide/), and [React Router routing](https://reactrouter.com/start/declarative/routing).
