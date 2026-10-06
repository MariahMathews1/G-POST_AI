import { describe, it, expect, vi } from "vitest";
import { machineProfilesApi } from "./machineProfiles";
import { ApiError } from "./client";
describe("Machine Profile API", () => {
  it("loads and saves through encoded Machine/fact paths", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await machineProfilesApi.get("machine/id");
    expect(fetch.mock.calls[0][0]).toBe("/api/machines/machine%2Fid/profile");
    const data = {
      value: 3000,
      unit: "rpm",
      status: "NEEDS_REVIEW" as const,
      source_document_id: null,
      source_location: "",
      engineering_notes: "",
    };
    await machineProfilesApi.save("m1", "max/speed", data);
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/machines/m1/profile/facts/max%2Fspeed",
      expect.objectContaining({ method: "PUT", body: JSON.stringify(data) }),
    );
  });
  it("exposes understandable profile validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: "Enter a value before confirming information.",
          }),
          { status: 422 },
        ),
      ),
    );
    await expect(machineProfilesApi.get("m1")).rejects.toThrow(
      "Enter a value before confirming information.",
    );
  });
  it("handles network failure without showing internal errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("internal detail")),
    );
    await expect(machineProfilesApi.get("m1")).rejects.toBeInstanceOf(ApiError);
    await expect(machineProfilesApi.get("m1")).rejects.toThrow(
      "Cannot reach the profile service.",
    );
  });
});
