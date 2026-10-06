export const documentTypes = {
  MACHINE_MANUAL: "Machine Manual",
  CONTROLLER_MANUAL: "Controller Manual",
  PROGRAMMING_MANUAL: "Programming Manual",
  SPECIFICATION_SHEET: "Specification Sheet",
  GPOST_OFG_REFERENCE: "G-POST / OFG Reference",
  APPROVED_INTERNAL_REFERENCE: "Approved Internal Reference",
  OTHER: "Other",
} as const;
export type DocumentType = keyof typeof documentTypes;
export type DocumentStatus = "ACTIVE" | "ARCHIVED";
export interface DocumentMetadataInput {
  title: string;
  document_type: DocumentType;
  description: string;
}
export interface DocumentUploadInput extends DocumentMetadataInput {
  machine_id: string;
  file: File;
}
export interface DocumentRecord extends DocumentMetadataInput {
  id: string;
  machine_id: string;
  machine_name: string;
  original_filename: string;
  storage_key: string;
  file_type: "PDF" | "TXT" | "MD";
  file_size: number;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}
export interface DocumentFilters {
  machine_id?: string;
  status?: DocumentStatus;
  document_type?: DocumentType;
}
export interface UploadOptions {
  allowed_extensions: string[];
  max_file_size: number;
}
