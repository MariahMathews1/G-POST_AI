import { request } from "./client";
import type {
  Machine,
  MachineCreateInput,
  MachineUpdateInput,
  MachineStatus,
} from "../types/machine";
export const machinesApi = {
  list: (status?: MachineStatus, signal?: AbortSignal) =>
    request<Machine[]>(`/machines${status ? `?status=${status}` : ""}`, {
      signal,
    }),
  get: (id: string, signal?: AbortSignal) =>
    request<Machine>(`/machines/${encodeURIComponent(id)}`, { signal }),
  create: (input: MachineCreateInput) =>
    request<Machine>("/machines", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: MachineUpdateInput) =>
    request<Machine>(`/machines/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  archive: (id: string) =>
    request<Machine>(`/machines/${encodeURIComponent(id)}/archive`, {
      method: "POST",
    }),
  restore: (id: string) =>
    request<Machine>(`/machines/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    }),
};
