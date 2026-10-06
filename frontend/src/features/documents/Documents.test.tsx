import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import { documentsApi } from "../../api/documents";
import { machinesApi } from "../../api/machines";
import { ApiError } from "../../api/client";
import type { DocumentRecord } from "../../types/document";
import type { Machine } from "../../types/machine";
const machine: Machine = {
  id: "machine-1",
  name: "KLS-1840N Demo",
  manufacturer: "KENT",
  model: "KLS-1840N",
  machine_type: "Lathe",
  controller: "FANUC 0i-TF",
  notes: "",
  status: "ACTIVE",
  created_at: "2026-10-06T12:00:00Z",
  updated_at: "2026-10-06T12:00:00Z",
};
const fixture: DocumentRecord = {
  id: "document-1",
  machine_id: machine.id,
  machine_name: machine.name,
  title: "KLS Machine Manual",
  document_type: "MACHINE_MANUAL",
  original_filename: "manual.pdf",
  storage_key: "internal.pdf",
  file_type: "PDF",
  file_size: 2048,
  description: "Machine reference manual used for V2 development.",
  status: "ACTIVE",
  created_at: "2026-10-06T12:00:00Z",
  updated_at: "2026-10-06T12:00:00Z",
};
let records: DocumentRecord[];
function open(route = "/documents") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByLabelText("Machine");
  await user.selectOptions(screen.getByLabelText("Machine"), machine.id);
  await user.type(
    screen.getByLabelText("Document Title"),
    " KLS Machine Manual ",
  );
  await user.selectOptions(
    screen.getByLabelText("Document Type"),
    "MACHINE_MANUAL",
  );
  await user.type(
    screen.getByLabelText(/Description \/ Notes/),
    fixture.description,
  );
  await user.upload(
    screen.getByLabelText("File"),
    new File(["%PDF-1.4\n%%EOF"], "manual.pdf", { type: "application/pdf" }),
  );
}
beforeEach(() => {
  records = [];
  vi.spyOn(machinesApi, "list").mockResolvedValue([machine]);
  vi.spyOn(machinesApi, "get").mockResolvedValue(machine);
  vi.spyOn(documentsApi, "list").mockImplementation(async (filters) =>
    records.filter(
      (document) =>
        (!filters?.machine_id || document.machine_id === filters.machine_id) &&
        (!filters?.status || document.status === filters.status) &&
        (!filters?.document_type ||
          document.document_type === filters.document_type),
    ),
  );
  vi.spyOn(documentsApi, "uploadOptions").mockResolvedValue({
    allowed_extensions: [".pdf", ".txt", ".md"],
    max_file_size: 25 * 1024 * 1024,
  });
  vi.spyOn(documentsApi, "get").mockImplementation(async (id) => {
    const document = records.find((document) => document.id === id);
    if (!document) throw new ApiError("Document not found.", 404);
    return { ...document };
  });
  vi.spyOn(documentsApi, "upload").mockImplementation(async (input) => {
    const document = {
      ...fixture,
      title: input.title,
      description: input.description,
      document_type: input.document_type,
      machine_id: input.machine_id,
      original_filename: input.file.name,
      file_size: input.file.size,
    };
    records.push(document);
    return document;
  });
  vi.spyOn(documentsApi, "update").mockImplementation(async (id, input) => {
    const index = records.findIndex((document) => document.id === id);
    records[index] = { ...records[index], ...input };
    return { ...records[index] };
  });
  vi.spyOn(documentsApi, "archive").mockImplementation(async (id) => {
    const document = records.find((document) => document.id === id)!;
    document.status = "ARCHIVED";
    return { ...document };
  });
  vi.spyOn(documentsApi, "restore").mockImplementation(async (id) => {
    const document = records.find((document) => document.id === id)!;
    document.status = "ACTIVE";
    return { ...document };
  });
});
describe("Document management", () => {
  it("renders the global empty state and three simple filters", async () => {
    open();
    expect(
      screen.getByRole("heading", { name: "Documents", level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No documents have been uploaded yet."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("ACTIVE");
    expect(screen.getByLabelText("Machine")).toBeInTheDocument();
    expect(screen.getByLabelText("Document Type")).toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual([
      "Document",
      "Machine",
      "Type",
      "File",
      "Size",
      "Uploaded",
      "Status",
      "Action",
    ]);
  });
  it("loads a useful upload form with real saved Machines and server limits", async () => {
    open("/documents/upload");
    expect(await screen.findByLabelText("Machine")).toBeRequired();
    expect(screen.getByRole("option", { name: machine.name })).toHaveValue(
      machine.id,
    );
    expect(screen.getByLabelText("File")).toHaveAttribute(
      "accept",
      ".pdf,.txt,.md",
    );
    expect(screen.getByText(/Maximum file size: 25.0 MB/)).toBeInTheDocument();
    expect(
      screen.queryByText(/OCR|AI Summary|Extract/),
    ).not.toBeInTheDocument();
  });
  it("requires a saved Machine before uploading", async () => {
    vi.mocked(machinesApi.list).mockResolvedValue([]);
    open("/documents/upload");
    expect(
      await screen.findByText(
        "Add a Machine before uploading a reference document.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "+ Add Machine" }),
    ).toBeInTheDocument();
  });
  it("uploads a document with trimmed metadata and opens detail", async () => {
    const user = userEvent.setup();
    open("/documents/upload");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Upload Document" }));
    expect(
      await screen.findByRole("heading", { name: fixture.title, level: 1 }),
    ).toBeInTheDocument();
    expect(documentsApi.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        machine_id: machine.id,
        title: fixture.title,
        document_type: "MACHINE_MANUAL",
        file: expect.any(File),
      }),
    );
    expect(screen.getByText(fixture.description)).toBeInTheDocument();
  });
  it("preselects the Machine when started from its Documents tab", async () => {
    const user = userEvent.setup();
    open(`/machines/${machine.id}`);
    await screen.findByRole("heading", { name: machine.name, level: 1 });
    await user.click(screen.getByRole("tab", { name: "Documents" }));
    await screen.findByText("No documents have been uploaded yet.");
    await user.click(
      within(screen.getByRole("tabpanel")).getAllByRole("link", {
        name: "Upload Document",
      })[0],
    );
    expect(await screen.findByLabelText("Machine")).toHaveValue(machine.id);
  });
  it("shows a document globally with its associated Machine", async () => {
    records.push({ ...fixture });
    open();
    expect(await screen.findByText(fixture.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: machine.name })).toHaveAttribute(
      "href",
      `/machines/${machine.id}`,
    );
    expect(
      screen.getByRole("link", { name: `Open ${fixture.title}` }),
    ).toHaveAttribute("href", `/documents/${fixture.id}`);
  });
  it("filters the Machine tab without repeating a Machine column", async () => {
    records.push(
      { ...fixture },
      {
        ...fixture,
        id: "document-2",
        machine_id: "other",
        title: "Other reference",
      },
    );
    const user = userEvent.setup();
    open(`/machines/${machine.id}`);
    await screen.findByRole("heading", { name: machine.name, level: 1 });
    await user.click(screen.getByRole("tab", { name: "Documents" }));
    expect(await screen.findByText(fixture.title)).toBeInTheDocument();
    expect(screen.queryByText("Other reference")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual(["Document", "Type", "File", "Uploaded", "Status", "Action"]);
    expect(documentsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ machine_id: machine.id, status: "ACTIVE" }),
      expect.any(AbortSignal),
    );
  });
  it("applies global Machine and Document Type filters", async () => {
    records.push(
      { ...fixture },
      {
        ...fixture,
        id: "second",
        document_type: "CONTROLLER_MANUAL",
        title: "Controller manual",
      },
    );
    const user = userEvent.setup();
    open();
    await screen.findByText(fixture.title);
    await user.selectOptions(screen.getByLabelText("Machine"), machine.id);
    await user.selectOptions(
      screen.getByLabelText("Document Type"),
      "CONTROLLER_MANUAL",
    );
    expect(await screen.findByText("Controller manual")).toBeInTheDocument();
    expect(screen.queryByText(fixture.title)).not.toBeInTheDocument();
    expect(documentsApi.list).toHaveBeenLastCalledWith(
      {
        machine_id: machine.id,
        document_type: "CONTROLLER_MANUAL",
        status: "ACTIVE",
      },
      expect.any(AbortSignal),
    );
  });
  it("renders metadata with view and download links", async () => {
    records.push({ ...fixture });
    open(`/documents/${fixture.id}`);
    await screen.findByRole("heading", { name: fixture.title, level: 1 });
    expect(screen.getByText(fixture.original_filename)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View / Open File" }),
    ).toHaveAttribute("href", `/api/documents/${fixture.id}/file`);
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      `/api/documents/${fixture.id}/file?download=true`,
    );
  });
  it("edits only metadata then displays the changed title in both lists", async () => {
    records.push({ ...fixture });
    const user = userEvent.setup();
    open(`/documents/${fixture.id}`);
    await user.click(await screen.findByRole("link", { name: "Edit Details" }));
    const title = await screen.findByLabelText("Document Title");
    await user.clear(title);
    await user.type(title, "Updated manual");
    expect(screen.queryByLabelText("File")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Machine")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(
      await screen.findByRole("heading", { name: "Updated manual", level: 1 }),
    ).toBeInTheDocument();
    expect(documentsApi.update).toHaveBeenCalledWith(fixture.id, {
      title: "Updated manual",
      document_type: "MACHINE_MANUAL",
      description: fixture.description,
    });
    await user.click(screen.getByRole("link", { name: "← Documents" }));
    expect(await screen.findByText("Updated manual")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: machine.name }));
    await screen.findByRole("heading", { name: machine.name, level: 1 });
    await user.click(screen.getByRole("tab", { name: "Documents" }));
    expect(await screen.findByText("Updated manual")).toBeInTheDocument();
  });
  it("archives, shows Archived/All, and restores the same document", async () => {
    records.push({ ...fixture });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    open(`/documents/${fixture.id}`);
    await user.click(await screen.findByRole("button", { name: "Archive" }));
    await screen.findByRole("button", { name: "Restore" });
    await user.click(screen.getByRole("link", { name: "← Documents" }));
    await screen.findByText("No documents have been uploaded yet.");
    await user.selectOptions(screen.getByLabelText("Status"), "ARCHIVED");
    await screen.findByText(fixture.title);
    await user.selectOptions(screen.getByLabelText("Status"), "ALL");
    await user.click(
      await screen.findByRole("link", { name: `Open ${fixture.title}` }),
    );
    await user.click(await screen.findByRole("button", { name: "Restore" }));
    await screen.findByRole("button", { name: "Archive" });
    await user.click(screen.getByRole("link", { name: "← Documents" }));
    expect(await screen.findByText(fixture.title)).toBeInTheDocument();
    expect(records).toHaveLength(1);
    expect(records[0].storage_key).toBe(fixture.storage_key);
  });
  it("does not archive when confirmation is canceled", async () => {
    records.push({ ...fixture });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    open(`/documents/${fixture.id}`);
    await user.click(await screen.findByRole("button", { name: "Archive" }));
    expect(documentsApi.archive).not.toHaveBeenCalled();
  });
  it("reports required upload fields without sending a request", async () => {
    const user = userEvent.setup();
    open("/documents/upload");
    await screen.findByLabelText("Machine");
    await user.click(screen.getByRole("button", { name: "Upload Document" }));
    expect(
      screen.getByText("Choose a reference document."),
    ).toBeInTheDocument();
    expect(screen.getByText("Document Title is required.")).toBeInTheDocument();
    expect(documentsApi.upload).not.toHaveBeenCalled();
  });
  it("rejects an oversized file using the backend's configured limit", async () => {
    vi.mocked(documentsApi.uploadOptions).mockResolvedValue({
      allowed_extensions: [".pdf", ".txt", ".md"],
      max_file_size: 1,
    });
    const user = userEvent.setup();
    open("/documents/upload");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Upload Document" }));
    expect(
      screen.getByText(/File exceeds the 1 B upload limit/),
    ).toBeInTheDocument();
    expect(documentsApi.upload).not.toHaveBeenCalled();
  });
  it("rejects unsupported and empty files before upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    open("/documents/upload");
    await fill(user);
    await user.upload(
      screen.getByLabelText("File"),
      new File(["data"], "part.nc"),
    );
    await user.click(screen.getByRole("button", { name: "Upload Document" }));
    expect(screen.getByText(/Unsupported file/)).toBeInTheDocument();
    await user.upload(
      screen.getByLabelText("File"),
      new File([], "empty.txt", { type: "text/plain" }),
    );
    await user.click(screen.getByRole("button", { name: "Upload Document" }));
    expect(screen.getByText(/The file is empty/)).toBeInTheDocument();
    expect(documentsApi.upload).not.toHaveBeenCalled();
  });
  it("shows upload errors and preserves form values", async () => {
    vi.mocked(documentsApi.upload).mockRejectedValue(
      new ApiError("The document could not be stored. Try again.", 503),
    );
    const user = userEvent.setup();
    open("/documents/upload");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Upload Document" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be stored",
    );
    expect(screen.getByLabelText("Document Title")).toHaveValue(
      " KLS Machine Manual ",
    );
    expect(
      screen.getByRole("button", { name: "Upload Document" }),
    ).toBeEnabled();
  });
  it("shows uploading state and disables duplicate submission", async () => {
    vi.mocked(documentsApi.upload).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    open("/documents/upload");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Upload Document" }));
    expect(screen.getByRole("button", { name: "Uploading…" })).toBeDisabled();
    expect(screen.getByLabelText("File")).toBeDisabled();
  });
  it("handles document not found", async () => {
    open("/documents/missing");
    expect(
      await screen.findByRole("heading", { name: "Document not found" }),
    ).toBeInTheDocument();
  });
  it("shows loading and retries list failures", async () => {
    vi.mocked(documentsApi.list).mockRejectedValueOnce(
      new ApiError("Cannot reach the document service."),
    );
    const user = userEvent.setup();
    open();
    expect(screen.getByRole("status")).toHaveTextContent("Loading documents");
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("No documents have been uploaded yet."),
    ).toBeInTheDocument();
  });
  it("counts only Active documents and routes the Dashboard quick action", async () => {
    records.push(
      { ...fixture },
      { ...fixture, id: "archived", status: "ARCHIVED" },
    );
    const user = userEvent.setup();
    open("/dashboard");
    const card = screen.getByText("Documents", {
      selector: ".stat-card > span",
    }).parentElement!;
    await waitFor(() =>
      expect(within(card).getByText("1")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("link", { name: "Upload Document" }));
    expect(await screen.findByLabelText("File")).toBeInTheDocument();
  });
});
