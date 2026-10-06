import { request } from "./client";
import type {
  DocumentRecord,
  DocumentFilters,
  DocumentUploadInput,
  DocumentMetadataInput,
  UploadOptions,
} from "../types/document";
export const documentsApi = {
  list: (filters: DocumentFilters = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value) query.set(key, value);
    return request<DocumentRecord[]>(
      `/documents${query.size ? `?${query}` : ""}`,
      { signal },
    );
  },
  get: (id: string, signal?: AbortSignal) =>
    request<DocumentRecord>(`/documents/${encodeURIComponent(id)}`, { signal }),
  uploadOptions: (signal?: AbortSignal) =>
    request<UploadOptions>("/documents/upload-options", { signal }),
  upload: (input: DocumentUploadInput) => {
    const data = new FormData();
    data.append("machine_id", input.machine_id);
    data.append("title", input.title);
    data.append("document_type", input.document_type);
    data.append("description", input.description);
    data.append("file", input.file);
    return request<DocumentRecord>("/documents", {
      method: "POST",
      body: data,
    });
  },
  update: (id: string, input: DocumentMetadataInput) =>
    request<DocumentRecord>(`/documents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  archive: (id: string) =>
    request<DocumentRecord>(`/documents/${encodeURIComponent(id)}/archive`, {
      method: "POST",
    }),
  restore: (id: string) =>
    request<DocumentRecord>(`/documents/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    }),
  fileUrl: (id: string, download = false) =>
    `/api/documents/${encodeURIComponent(id)}/file${download ? "?download=true" : ""}`,
};
