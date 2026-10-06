import { request } from "./client";
import type {
  ExtractionDocument,
  ExtractionRun,
  CandidateReviewResponse,
} from "../types/profileExtraction";
const profile = (id: string) => `/machines/${encodeURIComponent(id)}/profile`;
export const profileExtractionApi = {
  documents: (id: string, signal?: AbortSignal) =>
    request<ExtractionDocument[]>(`${profile(id)}/extraction-documents`, {
      signal,
    }),
  find: (id: string, fact_keys: string[], document_ids: string[]) =>
    request<ExtractionRun>(`${profile(id)}/find-information`, {
      method: "POST",
      body: JSON.stringify({ fact_keys, document_ids }),
    }),
  candidates: (id: string, runId?: string, signal?: AbortSignal) =>
    request<ExtractionRun | null>(
      `${profile(id)}/candidates${runId ? `?run_id=${encodeURIComponent(runId)}` : ""}`,
      { signal },
    ),
  apply: (
    id: string,
    machine_id: string,
    expected_profile_updated_at: string | null,
  ) =>
    request<CandidateReviewResponse>(
      `/profile-candidates/${encodeURIComponent(id)}/apply`,
      {
        method: "POST",
        body: JSON.stringify({ machine_id, expected_profile_updated_at }),
      },
    ),
  reject: (id: string, machine_id: string) =>
    request<CandidateReviewResponse>(
      `/profile-candidates/${encodeURIComponent(id)}/reject`,
      { method: "POST", body: JSON.stringify({ machine_id }) },
    ),
};
