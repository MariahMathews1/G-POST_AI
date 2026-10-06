import { request } from "./client";
import type { FactInput, MachineProfile } from "../types/machineProfile";
export const machineProfilesApi = {
  get: (id: string, signal?: AbortSignal) =>
    request<MachineProfile>(`/machines/${encodeURIComponent(id)}/profile`, {
      signal,
    }),
  save: (id: string, key: string, input: FactInput) =>
    request<MachineProfile>(
      `/machines/${encodeURIComponent(id)}/profile/facts/${encodeURIComponent(key)}`,
      { method: "PUT", body: JSON.stringify(input) },
    ),
};
