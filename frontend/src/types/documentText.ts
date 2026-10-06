export type ProcessingState =
  "NOT_PROCESSED" | "PROCESSING" | "READY" | "PARTIAL" | "FAILED";
export const processingStates: Record<ProcessingState, string> = {
  NOT_PROCESSED: "Not Prepared",
  PROCESSING: "Preparing",
  READY: "Ready",
  PARTIAL: "Partial",
  FAILED: "Failed",
};
export type ProcessingMethod = "NATIVE_TEXT" | "OCR" | "PLAIN_TEXT";
export const processingMethods: Record<ProcessingMethod, string> = {
  NATIVE_TEXT: "Native text",
  OCR: "OCR",
  PLAIN_TEXT: "Plain text",
};
export interface DocumentProcessing {
  document_id: string;
  state: ProcessingState;
  total_pages: number;
  pages_processed: number;
  native_text_pages: number;
  ocr_pages: number;
  plain_text_pages: number;
  pages_with_no_usable_text: number;
  message: string;
  started_at: string | null;
  processed_at: string | null;
}
export interface PageTextSummary {
  id: string;
  document_id: string;
  page_number: number;
  processing_method: ProcessingMethod;
  character_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
export interface DocumentPageText extends PageTextSummary {
  text: string;
}
