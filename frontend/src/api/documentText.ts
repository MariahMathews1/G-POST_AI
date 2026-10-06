import { request } from "./client";
import type {
  DocumentProcessing,
  DocumentPageText,
  PageTextSummary,
} from "../types/documentText";
const path = (id: string) => `/documents/${encodeURIComponent(id)}`;
export const documentTextApi = {
  status: (id: string, signal?: AbortSignal) =>
    request<DocumentProcessing>(`${path(id)}/processing`, { signal }),
  process: (id: string) =>
    request<DocumentProcessing>(`${path(id)}/process`, { method: "POST" }),
  pages: (id: string, signal?: AbortSignal) =>
    request<PageTextSummary[]>(`${path(id)}/pages`, { signal }),
  page: (id: string, number: number, signal?: AbortSignal) =>
    request<DocumentPageText>(`${path(id)}/pages/${number}`, { signal }),
};
