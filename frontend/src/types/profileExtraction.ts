import type { DocumentRecord } from "./document";
import type { FactValue, MachineProfile } from "./machineProfile";
export interface ExtractionDocument extends DocumentRecord {
  processing_state: "READY" | "PARTIAL";
}
export interface ProposedFactCandidate {
  id: string;
  run_id: string;
  machine_id: string;
  fact_key: string;
  kind: "VALUE" | "RELATED_EVIDENCE";
  candidate_value: FactValue;
  candidate_unit: string | null;
  document_id: string;
  document_title: string;
  file_type: "PDF" | "TXT" | "MD";
  page_number: number;
  evidence_text: string;
  match_method: string;
  status: "PROPOSED" | "APPLIED" | "REJECTED";
  created_at: string;
  reviewed_at: string | null;
}
export interface ExtractionResult {
  fact_key: string;
  display_name: string;
  state:
    | "CANDIDATE_FOUND"
    | "MULTIPLE_CANDIDATES_FOUND"
    | "RELATED_EVIDENCE_ONLY"
    | "NO_INFORMATION_FOUND"
    | "PROCESSING_ERROR";
  message: string;
  warnings: string[];
  candidates: ProposedFactCandidate[];
}
export interface ExtractionRun {
  id: string;
  machine_id: string;
  selected_fact_keys: string[];
  selected_document_ids: string[];
  documents: {
    id: string;
    title: string;
    document_type: DocumentRecord["document_type"];
    file_type: DocumentRecord["file_type"];
    processing_state: "READY" | "PARTIAL";
  }[];
  started_at: string;
  completed_at: string;
  results: ExtractionResult[];
}
export interface CandidateReviewResponse {
  run: ExtractionRun;
  profile: MachineProfile;
}
