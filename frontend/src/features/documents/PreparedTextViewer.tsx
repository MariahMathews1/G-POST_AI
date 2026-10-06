import { useEffect, useState } from "react";
import { documentTextApi } from "../../api/documentText";
import {
  processingMethods,
  type DocumentPageText,
  type PageTextSummary,
} from "../../types/documentText";
export default function PreparedTextViewer({
  id,
  isPdf,
}: {
  id: string;
  isPdf: boolean;
}) {
  const [pages, setPages] = useState<PageTextSummary[]>([]);
  const [page, setPage] = useState<DocumentPageText | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    documentTextApi
      .pages(id, controller.signal)
      .then(async (rows) => {
        if (controller.signal.aborted) return;
        setPages(rows);
        if (rows.length) {
          const number = rows.some((p) => p.page_number === selected)
            ? selected
            : rows[0].page_number;
          const result = await documentTextApi.page(
            id,
            number,
            controller.signal,
          );
          if (!controller.signal.aborted) {
            setSelected(number);
            setPage(result);
          }
        }
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, selected, attempt]);
  return (
    <div className="prepared-text-viewer">
      <p className="helper">
        Read-only prepared text.{" "}
        {isPdf
          ? "Page numbers refer to the original PDF, starting at page 1."
          : "This text reference is one logical section."}
      </p>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button
            className="button"
            onClick={() => {
              setError("");
              setLoading(true);
              setAttempt((n) => n + 1);
            }}
          >
            Retry prepared text
          </button>
        </>
      ) : (
        <>
          {pages.length > 0 && (
            <div className="form-field prepared-page-selector">
              <label htmlFor="prepared-page">
                {isPdf ? "PDF page" : "Text section"}
              </label>
              <select
                id="prepared-page"
                value={selected || pages[0].page_number}
                onChange={(e) => {
                  setLoading(true);
                  setSelected(Number(e.target.value));
                }}
              >
                {pages.map((p) => (
                  <option key={p.page_number} value={p.page_number}>
                    {isPdf ? "PDF page" : "Section"} {p.page_number} —{" "}
                    {processingMethods[p.processing_method]}
                    {p.error_message ? " (No usable text)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {loading ? (
            <p role="status">Loading prepared text…</p>
          ) : !pages.length ? (
            <p>No prepared pages are available. Reprocess the document.</p>
          ) : (
            page && (
              <>
                <p className="helper">
                  {isPdf ? "PDF page" : "Section"} {page.page_number} ·{" "}
                  {processingMethods[page.processing_method]} · Prepared{" "}
                  {new Date(page.updated_at).toLocaleString()}
                </p>
                {page.error_message ? (
                  <p className="notice">{page.error_message}</p>
                ) : (
                  <pre className="prepared-page-text">{page.text}</pre>
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
