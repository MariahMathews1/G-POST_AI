import { useEffect, useState } from "react";
import { documentsApi } from "../../api/documents";
import { ApiError } from "../../api/client";
import type { DocumentRecord } from "../../types/document";
export function useDocument(id: string) {
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    documentsApi
      .get(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setDocument(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof ApiError
              ? error
              : new ApiError("Document could not be loaded. Try again."),
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, attempt]);
  function retry() {
    setError(null);
    setLoading(true);
    setAttempt((value) => value + 1);
  }
  return { document, setDocument, loading, error, retry };
}
