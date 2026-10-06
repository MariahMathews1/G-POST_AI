import { expect, it, vi } from "vitest";
import { documentsApi } from "./documents";
it("sends multipart FormData without a JSON content type", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  const file = new File(["reference"], "manual.txt", { type: "text/plain" });
  await documentsApi.upload({
    machine_id: "machine-1",
    title: "Manual",
    document_type: "MACHINE_MANUAL",
    description: "Notes",
    file,
  });
  const [path, options] = fetch.mock.calls[0];
  expect(path).toBe("/api/documents");
  expect(options.method).toBe("POST");
  expect(options.headers).not.toHaveProperty("Content-Type");
  expect(options.body).toBeInstanceOf(FormData);
  expect(options.body.get("machine_id")).toBe("machine-1");
  expect(options.body.get("file").name).toBe("manual.txt");
});
it("encodes all document filters", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response("[]"));
  vi.stubGlobal("fetch", fetch);
  await documentsApi.list({
    machine_id: "a/b",
    status: "ARCHIVED",
    document_type: "OTHER",
  });
  expect(fetch.mock.calls[0][0]).toBe(
    "/api/documents?machine_id=a%2Fb&status=ARCHIVED&document_type=OTHER",
  );
});
it("uses PATCH for metadata and separate status endpoints", async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  await documentsApi.update("id", {
    title: "Manual",
    document_type: "OTHER",
    description: "",
  });
  await documentsApi.archive("id");
  await documentsApi.restore("id");
  expect(fetch.mock.calls.map((call) => [call[0], call[1].method])).toEqual([
    ["/api/documents/id", "PATCH"],
    ["/api/documents/id/archive", "POST"],
    ["/api/documents/id/restore", "POST"],
  ]);
});
it("preserves clear upload failure and field messages", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            detail:
              "Unsupported file. Choose a PDF, TXT, or MD reference document.",
            field: "file",
          }),
          { status: 415 },
        ),
      ),
  );
  await expect(
    documentsApi.upload({
      machine_id: "one",
      title: "Manual",
      document_type: "OTHER",
      description: "",
      file: new File(["data"], "part.nc"),
    }),
  ).rejects.toMatchObject({
    status: 415,
    fields: { file: expect.stringContaining("Unsupported file") },
  });
});
it("reports unavailable document service", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Network failed")),
  );
  await expect(documentsApi.list()).rejects.toThrow(
    "Cannot reach the document service",
  );
});
it("uses original-file URLs with explicit download choice", () => {
  expect(documentsApi.fileUrl("a/b")).toBe("/api/documents/a%2Fb/file");
  expect(documentsApi.fileUrl("id", true)).toBe(
    "/api/documents/id/file?download=true",
  );
});
