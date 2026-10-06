import { describe, it, expect, vi } from "vitest";
import { documentTextApi } from "./documentText";
describe("Document Text API", () => {
  it("uses dedicated encoded local Document paths", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await documentTextApi.status("doc/id");
    await documentTextApi.process("doc/id");
    await documentTextApi.pages("doc/id");
    await documentTextApi.page("doc/id", 5);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      "/api/documents/doc%2Fid/processing",
      "/api/documents/doc%2Fid/process",
      "/api/documents/doc%2Fid/pages",
      "/api/documents/doc%2Fid/pages/5",
    ]);
    expect(fetch.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("passes useful already-processing errors through to the interface", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              detail: "This document is already being prepared.",
            }),
            { status: 409 },
          ),
        ),
    );
    await expect(documentTextApi.process("d1")).rejects.toThrow(
      "This document is already being prepared.",
    );
  });
});
