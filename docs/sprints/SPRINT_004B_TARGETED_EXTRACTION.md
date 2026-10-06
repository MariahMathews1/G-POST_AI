# Sprint 4B — Targeted Machine Profile Extraction

Sprint 4B activates **Machine Profile → Find Information** for saved Machines. It searches only the programmer's selected facts and prepared references, using local Python rules. It creates reviewable proposals with source evidence. Search never writes a canonical profile value.

## Architecture and review boundary

```text
Selected Profile Fact
        ↓
Prepared Documents
        ↓
Deterministic Search
        ↓
Candidate + Evidence
        ↓
Human Review
     ↙       ↘
 Reject      Apply
              ↓
       Machine Profile
       Needs Review
              ↓
       Human Confirmation
```

Starting from selected facts gives each search a specific engineering question. Selecting references bounds its sources. The service scans the stored text of those selected documents page by page for configured terms; it does not attempt broad interpretation or summarization of entire manuals. Original files are not modified or sent to another service. Preparing or reprocessing documents remains a separate Sprint 4A action.

A **Proposed Fact Candidate** is an extracted value, or related evidence without a safe value, awaiting human review. It is stored separately from `profile_facts`. Finding something is not proof that it applies to this machine: controller capabilities can exceed machine capabilities. All distinct candidates are shown, including conflicting values. **No Information Found** is a useful result when the selected references contain no matching passage; it is not a claim that the capability does not exist.

## Supported facts and configuration

The existing 43-fact catalog and applicability rules remain authoritative. Adjacent configuration in `backend/app/profile_extraction/rules.json` enables these 13 facts, attached to the API fact definitions as extraction metadata:

| Fact | Extraction rule |
| --- | --- |
| Controller Series / Version | Short explicitly labeled text containing a model/version number |
| Programming Units | Explicit metric or imperial terms; both when both systems appear |
| Number of Controlled Axes | Explicit positive integer axis count |
| Linear Axes | Explicit X/Y/Z list |
| Axis Configuration | Short explicitly labeled text containing axis letters or an axis-count designation |
| X Axis Minimum / Maximum | Direct signed positions with explicit length units |
| Y Axis Minimum / Maximum | Direct signed positions with explicit length units, when applicable |
| Z Axis Minimum / Maximum | Direct signed positions with explicit length units |
| Maximum Spindle Speed | Explicit number and rotational unit; upper endpoint of a plainly labeled range |
| Maximum Feedrate | Explicit number and feed unit; upper endpoint of a plainly labeled range |

Configuration provides phrase aliases, extractor selection, unit aliases, optional related terms, text restrictions, range policy, and preferred document types. Value types and allowed canonical units come from the profile catalog. React only reads eligibility and renders selections; extraction rules run in Python.

Inherited Machine Record fields are excluded. Machine-type applicability filters the list, so Y limits are unavailable for a Lathe. Existing values remain selectable and are displayed beside their facts.

## Search and normalization

1. Validate selected facts and documents on the server. Sources must belong to the Machine, be ACTIVE, be PDF/TXT/MD, and have READY or PARTIAL preparation with at least one successful nonempty stored page.
2. Match configured phrases case-insensitively, normalizing separator differences such as whitespace, slashes, and hyphens. A phrase may wrap within one physical page.
3. Parse the remainder of its labeled line, or the immediate following line when the label has no value. Parsing is bounded to 600 characters and uses the selected fact's extractor.
4. Validate the extracted value using existing profile validation. Preserve nearby preceding/following lines as evidence, bounded to 1,200 characters. The evidence retains source spelling and units.
5. Retain values and related-only evidence in separate candidates. Collapse repeated identical value/unit occurrences within the same source page; retain distinct pages and sources.
6. Rank direct values at 100 and related evidence at 20. A preferred source type adds 5. Machine Manuals and Specification Sheets are preferred for physical limits/axes; Controller Manuals and Programming Manuals are preferred for controller version/programming units. Ties use document ID, page, then candidate ID. These internal scores are omitted from API responses and the normal UI; they never select or apply a value.

Examples: `4,000 RPM`, `4000 rev/min`, `4000 min^-1`, `4000 min-1`, and `4000 min⁻¹` normalize to `4000 rpm`. `inch`, `inches`, `in`, and the inch symbol normalize to `in`; millimeter/millimetre variants normalize to `mm`. Feed aliases such as IPM normalize to `in/min`. Canonical units remain lowercase to match the existing profile model. Thousands commas and Unicode minus signs are normalized; evidence is unchanged.

There is **no physical unit conversion**, unit inference, or default based on Programming Units. Missing or contradictory units, malformed numbers, and unparsed numeric alternatives/conditions produce related evidence rather than an invented value. The current numeric rule favors simple complete specification rows. A range such as `50–4000 rpm` can yield the upper endpoint for maximum spindle speed; coordinate min/max rules do not accept ranges.

`X travel = 20 in` or `X stroke = 500 mm` yields related evidence for X limits. Neither implies minimum zero or maximum equal to travel. Direct minimum/maximum labels and explicit units are required.

Every selected fact returns Candidate Found, Multiple Candidates Found, Related Evidence Only, No Information Found, or Processing Error. PARTIAL sources include warnings about unavailable pages; successful matches remain reviewable. An extractor failure is isolated to the affected fact/page, allowing other selected facts to complete.

## Persistence and Apply / Reject

Additive SQLite migrations 006 and 007 bring the schema to version 7 without rewriting Machines, Documents, preparation, or profile records.

`profile_search_runs` stores the Machine, selected facts/documents, source title/type/preparation snapshots, per-fact outcomes/warnings, and start/completion dates. It is a lightweight synchronous run record, not a job queue.

`profile_candidates` stores ID, run/Machine/fact IDs, VALUE or RELATED_EVIDENCE kind, typed JSON value, unit, document ID, one-based page number, evidence, match method, internal deterministic score, PROPOSED/APPLIED/REJECTED status, and created/reviewed dates. There is no AI confidence. Evidence and source snapshots survive document reprocessing; they do not depend on derived page-row IDs.

**Apply** is the only candidate action that changes a profile fact. The UI shows the current value and status beside the candidate and says that Apply replaces the current value. An atomic SQLite transaction checks candidate ownership, PROPOSED status, current applicability, and active source ownership. It compares the profile's last-update timestamp with the value shown to the programmer; a stale comparison returns 409 and requires refresh/review. It then saves:

- Extracted value and unit.
- `DOCUMENT_REFERENCE`, source document ID, and `PDF page N` or `Text section N`.
- `NEEDS_REVIEW`, including when replacing an existing CONFIRMED value.
- Existing engineering notes.
- Candidate status APPLIED and review date.

Both writes commit together or roll back together. Apply accepts the value for further engineering review; it does not engineer-confirm it. The existing profile editor is where a programmer verifies and manually sets CONFIRMED. Original evidence is never overwritten. Related-only evidence cannot be applied.

**Reject** sets REJECTED and its review date, retaining the candidate and leaving the profile untouched. Repeated reviews return 409. The latest saved run can be reopened from Find Information; an older run can be retrieved by API run ID. There is no full profile revision system or run-history browser. An APPLIED status records the historical action, not a guarantee that the profile still equals that candidate after later edits.

Sources must remain active and associated with the Machine when applying. Reprocessing does not invalidate a saved evidence snapshot; the programmer must independently verify its original source with Open Source.

## API and frontend flow

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/machines/{machine_id}/profile/extraction-documents` | Eligible prepared references |
| POST | `/api/machines/{machine_id}/profile/find-information` | Search selected `fact_keys` and `document_ids`; save run and proposals |
| GET | `/api/machines/{machine_id}/profile/candidates` | Latest run, or specified `?run_id=...`; null if no run exists |
| POST | `/api/profile-candidates/{candidate_id}/apply` | Body: `machine_id`, required nullable `expected_profile_updated_at`; updated run/profile |
| POST | `/api/profile-candidates/{candidate_id}/reject` | Body: `machine_id`; updated run/profile |

Find Information is enabled for a loaded saved Machine Profile and disabled for the unsaved demo. Step 1 groups applicable extraction-enabled facts with checkboxes and current values. Step 2 lists prepared references with title, type, and Ready/Partial state. Both support multiselect. An empty source list explains that no prepared documents exist and links to Documents; Refresh References reloads eligibility and clears unavailable selections. Nothing is prepared automatically.

The review screen groups outcomes by requested fact, showing current value/status, every candidate, source title, physical PDF page or text section, and evidence. Open Source opens the immutable original file, with `#page=N` for PDFs when supported by the browser. Apply and Reject have saving/error states. Refresh Current Values handles stale comparisons. Returning to Machine Profile shows updated values and counts. Search Again preserves choices, and Review Last Results reopens persisted decisions. Internal scores, regexes, and rule keys are not shown.

## Results UI refinement

The results screen now groups identical typed normalized values **and units** within each requested fact. Different values or units remain separate; source order follows the existing candidate ranking. This is a display-only grouping: candidate IDs, evidence, review states, and source records are not changed or merged in storage.

Each compact group shows its value, source count, short document/page list, and actions. Evidence is absent from the initial rendered view. Show Evidence reveals each underlying source's original excerpt and Open Source link; Hide Evidence collapses it again. Related Evidence has its own collapsed subsection. Current Profile Value and status remain at the top. Labels reflect distinct displayed values: 1 Candidate, Multiple Candidates, Related Evidence Only, or No Information Found; Processing Error is retained when applicable.

When several records support a value, the programmer must choose a Primary source before Apply. The UI submits that source's existing candidate ID to the unchanged Apply API, preserving its document/page as the profile's single provenance. Other source records remain untouched. Reject likewise acts on a selected record; expanded evidence also offers Reject Source. Reviewed decisions stay visible beside each source. Rejected records remain traceable but are excluded from the supporting-source count.

The refinement changes only `ExtractionResults.tsx`, its frontend tests, scoped extraction styles, and this guide. Backend architecture, extraction rules/generation, Apply/Reject persistence, provenance, and document processing are unchanged. Frontend verification: **114 tests pass**, including string/list/numeric grouping, separate conflicting values/units, collapsed/expanded evidence, related evidence, chosen-source Apply/provenance, and per-source Reject. Lint, typecheck, and production build pass. Browser visual verification remains unavailable because the browser tool has no available browser.

## Files created

- `backend/app/profile_extraction/__init__.py`, `rules.json`, `rules.py`, `search.py`, `service.py`, `schemas.py`, `routes.py`.
- `backend/app/profile_extraction/extractors/__init__.py`, `numeric.py`, `units.py`, `axes.py`, `text.py`.
- `backend/migrations/006_create_profile_search_runs.sql`, `007_create_profile_candidates.sql`.
- `backend/tests/test_profile_extraction.py`, `backend/tests/fixtures/targeted_reference.pdf`, `backend/tests/fixtures/generate_extraction_fixture.py` (synthetic references; ReportLab is an optional fixture tool, not an application dependency).
- `frontend/src/types/profileExtraction.ts`, `api/profileExtraction.ts`, `api/profileExtraction.test.ts`.
- `frontend/src/features/machineProfiles/FindInformation.tsx`, `ExtractionResults.tsx`, `ProfileExtraction.test.tsx`.
- This sprint guide.

## Files modified

- `backend/app/core/database.py`, `backend/app/main.py`: migration and router registration.
- `backend/app/machine_profiles/catalog.py`, `backend/app/machine_profiles/service.py`: extraction metadata and optional deferred commit for atomic Apply.
- `backend/tests/test_machines.py`, `backend/tests/test_documents.py`: schema version 7 assertions.
- `frontend/src/features/machines/tabs/MachineProfileTab.tsx`, `frontend/src/types/machineProfile.ts`: Find Information integration and eligibility type.
- `frontend/src/styles/global.css`, `frontend/src/features/machineProfiles/MachineProfiles.test.tsx`: extraction styles and updated action tests.
- `README.md`, `docs/V2_BLUEPRINT.md`: implementation status.

No new runtime dependencies. Existing user records and original files are preserved; synthetic acceptance writes use a separate temporary database.

## Verification and acceptance

- Backend: **210 tests passed**, including 50 targeted extraction tests. Coverage includes single/multiple facts and documents, unit normalization, ambiguous rows, related-only travel, no result, partial failures, ownership/applicability/source eligibility, persistence, explicit Apply, preserved page provenance, stale comparisons, Reject, and transaction rollback. Existing Sprint 1–4A tests pass.
- Frontend: **108 tests passed**, including 16 extraction API/UI tests. Coverage includes fact/document multiselect, source refresh, loading/errors, current comparisons, evidence/source links, multiple/no/related results, Apply/Reject, stale refresh, returning to Profile, and reopening saved results.
- Frontend lint, standalone typecheck, and production build pass.
- Live local HTTP acceptance: created a synthetic Machine and actual two-page PDF; prepared through Sprint 4A; found `4000 rpm` on physical page 2 with original `4,000 min^-1` evidence; displayed a conflicting controller value; verified search did not change an existing confirmed `3500 rpm`; explicitly applied and verified Needs Review plus document/page provenance; manually confirmed; rejected the conflicting candidate without profile change. No-information and related-travel outcomes also passed.
- Original PDF bytes remained unchanged. Run/candidate IDs, decisions, evidence, and profile values persisted through reprocessing and API restart. Frontend API proxy read-only checks passed for Machines, Documents, Profile, and new routes. Both synthetic PDF pages were rendered and visually inspected.
- **Browser visual/manual click-through acceptance was not completed:** the browser tool returned no available browser. Frontend DOM interaction tests cover the requested click flow; live HTTP checks cover actual persistence and preparation. This is the remaining acceptance limitation, not a claimed visual pass.

To repeat a browser acceptance check: open a saved Machine → Machine Profile → Find Information; select spindle speed and a prepared reference; review value/source/page/evidence; Apply; return and inspect Needs Review/source; manually Confirm; repeat and Reject a conflicting candidate; select an absent fact and check No Information Found. Verify conflicting values remain separate proposals until reviewed.

## Limits and intentional exclusions

Extraction depends on stored text and explicit terminology. OCR errors, unusual labels, multi-column tables, cross-page values, decimal commas, formulas, prose conditions, and unlabeled units may produce related evidence or no result. Controller text requires a model/version number; plain `Both` without explicit metric/imperial terms is not interpreted. Linear axes accept only explicit X/Y/Z lists. Axis Configuration preserves labeled text rather than interpreting kinematics. Search is synchronous and scans the selected documents; there are no indexes, embeddings, semantic retrieval, or large-manual performance guarantees.

Supported G-Codes/M-Codes are intentionally omitted: appearances in examples do not establish supported command lists. Tool Change Behavior, Work Offset Behavior, Spindle Orientation Behavior, cycle interpretation, Safe Start Sequence, Program Header/End requirements, Reset Conditions, and Required Modal Conditions remain manual. These complex facts may need deterministic evidence retrieval plus human interpretation, or later approved generative interpretation; they are not reduced to simplistic rules here.

Edit Before Apply is omitted; engineers can edit a profile value afterward using its existing editor. No Azure/OpenAI calls, generative AI, summaries, MATLAB, local ML, vector database, semantic RAG, chat, OFG recommendations, FIL/CIMFIL generation, G-code generation, CL/NCL processing, Post features, or automatic profile modifications were implemented. Python is sufficient for this deliberately limited rule set; Azure and MATLAB add no required capability for this sprint. Development stops at Sprint 4B.
