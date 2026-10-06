import { describe, it, expect, vi } from "vitest";
import { machinesApi } from "./machines";
import { ApiError } from "./client";
const input = {
  name: "Machine",
  manufacturer: "KENT",
  model: "KLS",
  machine_type: "Lathe" as const,
  controller: "FANUC",
  notes: "",
};
describe("Machine API client", () => {
  it("sends JSON to the create endpoint", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "one", ...input }), { status: 201 }),
      );
    vi.stubGlobal("fetch", fetch);
    await machinesApi.create(input);
    expect(fetch).toHaveBeenCalledWith(
      "/api/machines",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
  it("uses status filters and encoded IDs", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("[]"));
    vi.stubGlobal("fetch", fetch);
    await machinesApi.list("ARCHIVED");
    await machinesApi.list();
    await machinesApi.get("a/b");
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      "/api/machines?status=ARCHIVED",
      "/api/machines",
      "/api/machines/a%2Fb",
    ]);
  });
  it("uses PUT and explicit archive/restore endpoints", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await machinesApi.update("one", input);
    await machinesApi.archive("one");
    await machinesApi.restore("one");
    expect(fetch.mock.calls.map((call) => [call[0], call[1].method])).toEqual([
      ["/api/machines/one", "PUT"],
      ["/api/machines/one/archive", "POST"],
      ["/api/machines/one/restore", "POST"],
    ]);
  });
  it("turns connection failure into an understandable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Network error")),
    );
    await expect(machinesApi.list()).rejects.toThrow(
      "Cannot reach the machine service",
    );
  });
  it("maps backend validation to inline field errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              detail: [
                { loc: ["body", "name"], type: "string_too_short", input: "" },
              ],
            }),
            { status: 422 },
          ),
        ),
    );
    await expect(machinesApi.create(input)).rejects.toMatchObject({
      status: 422,
      fields: { name: "This field is required." },
    });
  });
  it("handles not-found and hides server internals", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(
        new Response("Traceback: secret path", { status: 500 }),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(machinesApi.get("missing")).rejects.toMatchObject({
      status: 404,
      message: "Machine not found.",
    });
    await expect(machinesApi.create(input)).rejects.toBeInstanceOf(ApiError);
  });
});
