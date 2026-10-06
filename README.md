# Creo NC G-POST Companion V2

The application is an engineering companion for NC programmers developing machine-specific Creo G-POST postprocessors.

It helps organize machine/controller documentation, build a reviewed Machine Profile, prepare an OFG configuration checklist, track custom FIL/CIMFIL requirements, and export a Post Development Package.

It does not replace Creo, G-POST, the Option File Generator, or VERICUT.

## Simple workflow

Machine → Documents → Machine Profile → Post Record → OFG Settings → Custom Logic if needed → Review & Export → Official G-POST workflow

Read the [V2 Blueprint](docs/V2_BLUEPRINT.md) for the screens, data, boundaries, proposed architecture, and sprint plan.

## Current Status

**V2 Sprint 0/1 — UI shell only.**

The current implementation contains navigation and placeholder screens only. No backend, persistence, extraction, Azure, MATLAB, OFG logic, FIL generation, or exports have been implemented. Form entries are not saved. Future actions are disabled; demo records are static examples.

## Run locally

Use Node.js 22.12+, 24.x, or 26+ and npm.

```sh
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Inspect `/machines/demo` and `/posts/demo` for the example workspaces. Vite supports direct navigation and refresh on these routes in development; a future static host must route application URLs to `index.html`.

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Frontend code lives in `frontend/src`: `app/` for routes, `components/` for layout and shared UI, `features/` for pages, and `styles/` for theme tokens and CSS. The next recommended sprint is Machines CRUD (create, read, update, archive), scoped separately before implementation.

Framework references: [Vite setup](https://vite.dev/guide/) and [React Router routing](https://reactrouter.com/start/declarative/routing).
