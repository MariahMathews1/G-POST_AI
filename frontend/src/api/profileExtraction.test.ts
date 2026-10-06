import { describe, it, expect, vi } from "vitest";
import { profileExtractionApi } from "./profileExtraction";
describe("Profile Extraction API", () => {
  it("uses encoded local paths and explicit selections/review requests", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await profileExtractionApi.documents("m/1");
    await profileExtractionApi.candidates("m/1", "r/1");
    await profileExtractionApi.find("m1", ["maximum_spindle_speed"], ["d1"]);
    await profileExtractionApi.apply("c/1", "m1", null);
    await profileExtractionApi.reject("c/1", "m1");
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([
      "/api/machines/m%2F1/profile/extraction-documents",
      "/api/machines/m%2F1/profile/candidates?run_id=r%2F1",
      "/api/machines/m1/profile/find-information",
      "/api/profile-candidates/c%2F1/apply",
      "/api/profile-candidates/c%2F1/reject",
    ]);
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({
      fact_keys: ["maximum_spindle_speed"],
      document_ids: ["d1"],
    });
    expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({
      machine_id: "m1",
      expected_profile_updated_at: null,
    });
  });
  it("preserves understandable conflict messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ detail: "The current profile value changed." }),
            { status: 409 },
          ),
        ),
    );
    await expect(profileExtractionApi.apply("c1", "m1", null)).rejects.toThrow(
      "The current profile value changed.",
    );
  });
});
