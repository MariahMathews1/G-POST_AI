import { useEffect, useState } from "react";
import { documentTextApi } from "../../api/documentText";
import {
  processingStates,
  type DocumentProcessing,
} from "../../types/documentText";
import PreparedTextViewer from "./PreparedTextViewer";
export default function DocumentTextSection({
  id,
  fileType,
}: {
  id: string;
  fileType: "PDF" | "TXT" | "MD";
}) {
  const [processing, setProcessing] = useState<DocumentProcessing | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showText, setShowText] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    documentTextApi
      .status(id, controller.signal)
      .then(setProcessing)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, attempt]);
  useEffect(() => {
    if (processing?.state !== "PROCESSING") return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight) return;
      inFlight = true;
      documentTextApi
        .status(id, controller.signal)
        .then((p) => {
          if (!controller.signal.aborted) {
            setProcessing(p);
            setError("");
          }
        })
        .catch((e: Error) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          inFlight = false;
        });
    }, 2000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [id, processing?.state]);
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      setProcessing(await documentTextApi.process(id));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Document text could not be prepared. Try again.",
      );
      try {
        setProcessing(await documentTextApi.status(id));
      } catch {
        /* Retain the last known result and offer retry. */
      }
    } finally {
      setBusy(false);
    }
  }
  const preparing = busy || processing?.state === "PROCESSING";
  return (
    <section
      className="panel padded document-text-section"
      aria-labelledby="document-text-heading"
    >
      <h2 id="document-text-heading">Document Text</h2>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!processing ? (
        error ? (
          <button
            className="button"
            onClick={() => {
              setError("");
              setAttempt((a) => a + 1);
            }}
          >
            Retry document text status
          </button>
        ) : (
          <p role="status">Loading document text status…</p>
        )
      ) : (
        <>
          <dl className="identity-grid document-text-summary">
            <div>
              <dt>Status</dt>
              <dd>
                {preparing ? "Preparing" : processingStates[processing.state]}
              </dd>
            </div>
            {processing.state !== "NOT_PROCESSED" && !preparing && (
              <>
                <div>
                  <dt>Pages processed</dt>
                  <dd>
                    {processing.pages_processed} of {processing.total_pages}
                  </dd>
                </div>
                {fileType === "PDF" ? (
                  <>
                    <div>
                      <dt>Native text pages</dt>
                      <dd>{processing.native_text_pages}</dd>
                    </div>
                    <div>
                      <dt>OCR pages</dt>
                      <dd>{processing.ocr_pages}</dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt>Plain text sections</dt>
                    <dd>{processing.plain_text_pages}</dd>
                  </div>
                )}
                {processing.pages_with_no_usable_text > 0 && (
                  <div>
                    <dt>Pages with no usable text</dt>
                    <dd>{processing.pages_with_no_usable_text}</dd>
                  </div>
                )}
                {processing.processed_at && (
                  <div>
                    <dt>Processed</dt>
                    <dd>
                      {new Date(processing.processed_at).toLocaleString()}
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>
          {preparing ? (
            <p role="status">
              Preparing document text locally. Large manuals may take a few
              minutes.
            </p>
          ) : (
            <p
              className={
                processing.state === "FAILED" || processing.state === "PARTIAL"
                  ? "notice"
                  : "helper"
              }
            >
              {processing.state === "NOT_PROCESSED"
                ? "This document has not been prepared for profile search."
                : processing.message}
            </p>
          )}
          <div className="actions">
            <button
              className="button primary"
              disabled={preparing}
              onClick={prepare}
            >
              {preparing
                ? "Preparing…"
                : processing.state === "NOT_PROCESSED"
                  ? "Prepare for Search"
                  : "Reprocess"}
            </button>
            {!preparing && processing.total_pages > 0 && (
              <button
                className="button"
                aria-expanded={showText}
                aria-controls="prepared-text-inspection"
                onClick={() => setShowText((s) => !s)}
              >
                {showText ? "Hide Prepared Text" : "View Prepared Text"}
              </button>
            )}
          </div>
          {!preparing && showText && processing.total_pages > 0 && (
            <div id="prepared-text-inspection">
              <PreparedTextViewer
                key={processing.processed_at}
                id={id}
                isPdf={fileType === "PDF"}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
