# Sprint 4A — Document processing foundation

This sprint prepares stored machine reference documents as local, page-aware text for future search. It does not search for facts, propose facts, or change Machine Profile. Preparation is an explicit action on Document Detail; upload alone does not start it.

```text
Original Document
       ↓
Native Text Attempt
       ↓
Usable?
 ┌─────┴─────┐
Yes          No
 ↓            ↓
Use text     OCR page
 └─────┬──────┘
       ↓
Normalized Page Text
       ↓
SQLite
       ↓
Ready for Targeted Search
```

## Processing architecture and libraries

Python remains the runtime. `pypdf` reads PDF text one page at a time. Native text is accepted when it contains letters/numbers and reaches the configured number of non-whitespace characters. This is a simple preparation threshold, not a confidence score or an interpretation of engineering content.

Only a page with too little native text, or a failed native extraction, falls back to OCR. `pypdfium2` renders that page, Pillow holds the image, and `pytesseract` invokes local Tesseract. Native-text pages are never rendered unnecessarily. PDFium access is protected by a lock because its library calls must not run concurrently across threads. Each image is copied before the renderer releases its memory, and page/image handles are closed after use.

TXT and MD become one logical section using UTF-8, UTF-8 with a byte-order mark, or BOM-marked UTF-16. Unknown encodings and strongly binary-looking data receive a clear failure message. Markdown is neither rendered nor semantically parsed.

Normalization changes line endings, removes null/control characters, and trims trailing line whitespace. It preserves indentation, tabs, repeated internal spaces, words, G/M code names, punctuation, numbers, and units. There is no rewriting, summarization, numerical correction, or unit conversion.

## OCR environment and configuration

The Python libraries are locked in `backend/uv.lock`. Install them with the existing command:

```sh
uv sync --directory backend
```

Tesseract is a separate optional local executable, not something the Python adapter installs. On macOS, install it with Homebrew when needed:

```sh
brew install tesseract
tesseract --version
tesseract --list-langs
```

On Debian/Ubuntu, the equivalent is `sudo apt-get install tesseract-ocr tesseract-ocr-eng`. The executable must be on the backend's PATH, and the selected language data must be installed. No cloud fallback exists.

The processor checks the runtime and required language data only when a page needs OCR. Missing support does not stop normal native-text PDFs or TXT/MD preparation. Pages that require unavailable OCR are recorded as unsuccessful with an explicit message; they are not silently accepted as blank text.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `COMPANION_MIN_NATIVE_TEXT_CHARACTERS` | `40` | Minimum non-whitespace native characters before skipping OCR. |
| `COMPANION_OCR_DPI` | `200` | Resolution used to render fallback pages. |
| `COMPANION_OCR_TIMEOUT_SECONDS` | `60` | Maximum Tesseract time for one page. |
| `COMPANION_OCR_LANGUAGE` | `eng` | Installed Tesseract language, or names joined by `+`. |
| `COMPANION_MAX_OCR_PIXELS` | `30000000` | Maximum rendered image area for one OCR page. |

Settings are read at backend startup. A short native-text page below the threshold still needs fallback; reduce the threshold deliberately if that is unsuitable for a particular local reference collection. A page with no usable OCR text, a rendering failure, or an OCR timeout receives a page-level error. OCR text can contain recognition errors and should be compared with the original before future engineering review.

## Filesystem and database

Original files remain in `backend/data/documents/` by default, using each Document's generated storage key. The existing `COMPANION_DOCUMENTS_DIR` override still applies. Preparation opens files for reading and never writes back to the original PDF/TXT/MD. Rendered OCR images are temporary, not replacement documents.

SQLite remains `backend/data/companion.sqlite3` by default, or `COMPANION_DB_PATH`. Migrations **004** and **005** add two tables; the schema version becomes 5. They preserve Machines, Documents, ProfileFact values, and original files.

- `document_processing`: one state/message and attempt timestamps per Document. An untouched Document has no row and reads as Not Processed.
- `document_page_text`: one result per Document + one-based page number. It stores ID, Document ID, page number, normalized text, processing method, character count, optional error message, and created/updated timestamps. Successful page timestamps identify the attempt that produced them. Failed pages explicitly retain their attempted method and error with empty text.

Methods are `NATIVE_TEXT`, `OCR`, and `PLAIN_TEXT`. PDF page 5 means the fifth physical PDF page, not an invented printed manual label. TXT/MD use section 1. Page identity and provenance allow the same source evidence to be retrieved later.

Summary counts are calculated from the page records. Pages processed means pages with usable text. Native/OCR/plain counts include successful pages only; unsuccessful pages have a separate count. A corrupt or missing original can fail before its page count is known, so its total is zero with a document-level explanation.

| State | Meaning |
| --- | --- |
| NOT_PROCESSED | Preparation has not run. |
| PROCESSING | A local attempt is running. |
| READY | All pages produced usable text. |
| PARTIAL | Some pages succeeded and others did not, or an interrupted attempt retained an older result. |
| FAILED | No usable result was produced. |

Preparation runs synchronously in the local backend request. Its claim is committed first, so another connection can read Processing while work runs. A duplicate attempt on the same Document returns 409. No background job system was introduced.

Reprocessing reads the unchanged original again. It replaces all derived page records in one SQLite transaction, including when the new attempt produces failed pages or no pages. The unique Document + page constraint prevents duplicates. During preparation, readers can still access the previous complete page set, but state is Processing; the normal viewer waits for completion. An unexpected database write failure rolls back the replacement and leaves prior pages intact. On a single-server restart, interrupted Processing rows become Partial if older usable pages remain, otherwise Failed, with a clear reprocess message.

## Backend routes and frontend

| Route | Purpose |
| --- | --- |
| `POST /api/documents/{id}/process` | Prepare/reprepare text; return the completed state and summary. |
| `GET /api/documents/{id}/processing` | Read state, messages, counts, and attempt times. |
| `GET /api/documents/{id}/pages` | List ordered page provenance/metadata, without the whole manual's text. |
| `GET /api/documents/{id}/pages/{number}` | Read one page's text, method, provenance, or explicit page failure. |

Missing Documents and prepared pages return 404; invalid page numbers return 422. Document preparation failures return a completed Failed/Partial result with readable messages. Database service failures return 503. Stack traces and filesystem paths are not exposed in frontend messages.

Document Detail adds a small **Document Text** section with Not Prepared/Preparing/Ready/Partial/Failed, **Prepare for Search** or **Reprocess**, counts, and a processed date. It can poll an existing attempt after a refresh. **View Prepared Text** opens restrained, read-only inspection of one physical PDF page or text section at a time. It shows the method and date and escapes text rather than rendering HTML/Markdown. Existing open/download/edit/archive controls and the global Documents table retain their behavior. Archived references can still be prepared and inspected.

## Files created and modified

Created:

```text
backend/app/documents/processing/
    config.py             thresholds and local OCR settings
    models.py             processing/page response models
    processor.py          preparation, atomic storage, state and recovery
    pdf_text.py           PDF reader, native extraction and fallback rendering
    ocr.py                local runtime detection and Tesseract adapter
    text_normalizer.py    conservative cleanup and usability threshold
    routes.py             four document text routes
    __init__.py
backend/migrations/004_create_document_processing.sql
backend/migrations/005_create_document_page_text.sql
backend/tests/test_document_processing.py
backend/tests/fixtures/
    native_reference.pdf, scanned_reference.pdf, mixed_reference.pdf
    reference.txt, reference.md, generate_processing_fixtures.py
frontend/src/types/documentText.ts
frontend/src/api/documentText.ts
frontend/src/api/documentText.test.ts
frontend/src/features/documents/DocumentTextSection.tsx
frontend/src/features/documents/PreparedTextViewer.tsx
frontend/src/features/documents/DocumentText.test.tsx
```

Modified: backend database startup, main application wiring, dependencies/lockfile, and existing Machine/Document migration expectations; frontend Document Detail, Document test mocks, shared API handling for 409, and scoped document text styles. README and the Blueprint status point to this guide. Machine Profile feature code, definitions, values, and Find Information were not changed.

Fixtures contain only synthetic reference text and were rendered and visually inspected. ReportLab is used only by the fixture generator, not by the application or normal tests. To regenerate them from the backend directory: `uv run --with reportlab python tests/fixtures/generate_processing_fixtures.py`.

## Verification and acceptance

- **160 backend tests passed**, including 27 new processing checks. Coverage includes native and real local OCR, page numbering, mixed pages, TXT/MD, configurable thresholds, missing/corrupt/encrypted originals, empty/invalid text, unavailable OCR, per-page failures, repeat processing, observable Processing state, duplicate requests, atomic rollback, archive, restart recovery, provenance, unchanged original bytes, and unchanged Machine Profile.
- **92 frontend tests passed**, including 15 new processing UI/API checks. They cover preparation, Ready/Partial/Failed, counts, reprocess, saved-state reload, polling, errors/retry, one-based read-only inspection, and TXT/MD display. Existing Documents and Sprints 1–3 tests pass.
- Frontend lint, typecheck, production build, and whitespace checks passed.
- Live local acceptance used synthetic references in a separate temporary database. Native PDF, mixed native/OCR PDF, TXT, and MD reached Ready. Page text and methods matched their fixtures; reprocessing created no duplicates; inline/download bytes stayed identical; Machine Profile stayed unchanged. The real frontend proxy and Document route responded successfully.
- An actual backend process restart preserved the four document states, counts, individual page text/provenance, and original bytes exactly.
- Local OCR validation used **Tesseract 5.5.2** with English data. The real OCR test skips when its runtime is absent; controlled missing-runtime tests always run.

No browser was available through the browser tool. Mouse-driven visual acceptance and an observed browser refresh were not performed; automated DOM tests and live HTTP/restart checks do not substitute for those observations.

For manual inspection, upload `backend/tests/fixtures/native_reference.pdf` or `mixed_reference.pdf` under a saved test Machine. Open its Document Detail, check Not Prepared, select Prepare for Search, inspect counts, and use View Prepared Text to compare PDF page 2 with the original. Refresh, then Reprocess and verify the page count stays stable. View/download the original and repeat with `reference.txt` or `reference.md`.

## Limits and scope boundary

This is a single local server with synchronous preparation, not a multi-worker/background job system. Large scanned manuals can take time; native extraction/rendering has no whole-document execution deadline. Rendering has a configured pixel limit and Tesseract has a per-page timeout. Image quality, language data, and technical page layout affect OCR accuracy; the page text is preparation evidence, not confirmed engineering information. Unknown text encodings and encrypted PDFs require a readable reference copy.

Only the existing PDF/TXT/MD allowlist is used. No CL/NCL/ACL/APT/NC, G-code, CAD, STEP/IGES, or toolpath format support was added. Filename/format restrictions cannot prove the contents are appropriate machine references. This remains a machine-level reference workflow, not part or production-program processing.

No content goes to external services. There are no cloud/Azure document calls, generative AI, embeddings, vector stores, RAG, MATLAB, machine learning, OFG/FIL recommendations, G-code generation, Post compilation, ProposedFactCandidate creation, Apply/Reject, or profile updates. These are not document text preparation.

Sprint 4B may search selected fact definitions against prepared document text and propose source-linked candidates for human review. That workflow does not exist here. Find Information remains disabled. **Sprint 4A stops at persistent page-aware text.**

Library references: [pypdf text extraction](https://pypdf.readthedocs.io/en/stable/user/extract-text.html), [pypdfium2 API and thread safety](https://pypdfium2.readthedocs.io/en/stable/python_api.html), and [pytesseract local runtime and timeout requirements](https://pypi.org/project/pytesseract/).
