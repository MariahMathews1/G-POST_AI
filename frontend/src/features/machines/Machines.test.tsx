import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../app/App";
import { machinesApi } from "../../api/machines";
import { ApiError } from "../../api/client";
import type { Machine } from "../../types/machine";

const fixture: Machine = {
  id: "machine-1",
  name: "KLS-1840N Demo",
  manufacturer: "KENT",
  model: "KLS-1840N",
  machine_type: "Lathe",
  controller: "FANUC 0i-TF",
  notes: "V2 demo machine",
  status: "ACTIVE",
  created_at: "2026-10-06T12:00:00+00:00",
  updated_at: "2026-10-06T12:00:00+00:00",
};
let records: Machine[];
function open(route = "/machines") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  for (const [label, value] of [
    ["Machine Name", " KLS-1840N Demo "],
    ["Manufacturer", " KENT "],
    ["Model", " KLS-1840N "],
    ["Controller", " FANUC 0i-TF "],
  ])
    await user.type(screen.getByLabelText(label), value);
  await user.selectOptions(screen.getByLabelText("Machine Type"), "Lathe");
  await user.type(screen.getByLabelText(/Notes/), " V2 demo machine ");
}

beforeEach(() => {
  records = [];
  vi.spyOn(machinesApi, "list").mockImplementation(async (status) =>
    records.filter((machine) => !status || machine.status === status),
  );
  vi.spyOn(machinesApi, "get").mockImplementation(async (id) => {
    const machine = records.find((machine) => machine.id === id);
    if (!machine) throw new ApiError("Machine not found.", 404);
    return { ...machine };
  });
  vi.spyOn(machinesApi, "create").mockImplementation(async (input) => {
    const machine = { ...fixture, ...input };
    records.push(machine);
    return machine;
  });
  vi.spyOn(machinesApi, "update").mockImplementation(async (id, input) => {
    const index = records.findIndex((machine) => machine.id === id);
    records[index] = {
      ...records[index],
      ...input,
      updated_at: "2026-10-06T13:00:00+00:00",
    };
    return { ...records[index] };
  });
  vi.spyOn(machinesApi, "archive").mockImplementation(async (id) => {
    const machine = records.find((machine) => machine.id === id)!;
    machine.status = "ARCHIVED";
    return { ...machine };
  });
  vi.spyOn(machinesApi, "restore").mockImplementation(async (id) => {
    const machine = records.find((machine) => machine.id === id)!;
    machine.status = "ACTIVE";
    return { ...machine };
  });
});

describe("Machine management", () => {
  it("renders an Active list with the useful empty state", async () => {
    open();
    expect(
      screen.getByRole("heading", { name: "Machines", level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No machines have been added yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getAllByRole("columnheader").map((cell) => cell.textContent),
    ).toEqual([
      "Machine",
      "Manufacturer",
      "Model",
      "Type",
      "Controller",
      "Status",
      "Action",
    ]);
  });
  it("shows a loading state while the list is pending", () => {
    vi.mocked(machinesApi.list).mockReturnValue(new Promise(() => {}));
    open();
    expect(screen.getByRole("status")).toHaveTextContent("Loading machines");
  });
  it("reports unavailable backend and allows retry", async () => {
    vi.mocked(machinesApi.list).mockRejectedValueOnce(
      new ApiError("Cannot reach the machine service."),
    );
    const user = userEvent.setup();
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("No machines have been added yet."),
    ).toBeInTheDocument();
  });
  it("renders the required form and all controlled machine types", () => {
    open("/machines/new");
    for (const label of [
      "Machine Name",
      "Manufacturer",
      "Model",
      "Machine Type",
      "Controller",
    ])
      expect(screen.getByLabelText(label)).toBeRequired();
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Select type", "Lathe", "Mill", "Mill-Turn", "Swiss", "Other"]);
    expect(screen.getByLabelText(/Notes/)).not.toBeRequired();
  });
  it("creates a trimmed machine and opens its Overview", async () => {
    const user = userEvent.setup();
    open("/machines/new");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Create Machine" }));
    expect(
      await screen.findByRole("heading", { name: "KLS-1840N Demo", level: 1 }),
    ).toBeInTheDocument();
    expect(machinesApi.create).toHaveBeenCalledWith({
      name: fixture.name,
      manufacturer: fixture.manufacturer,
      model: fixture.model,
      machine_type: fixture.machine_type,
      controller: fixture.controller,
      notes: fixture.notes,
    });
    expect(
      screen.getByRole("heading", { name: "Machine Information" }),
    ).toBeInTheDocument();
  });
  it("rejects whitespace-only fields inline", async () => {
    const user = userEvent.setup();
    open("/machines/new");
    await user.type(screen.getByLabelText("Machine Name"), "   ");
    await user.click(screen.getByRole("button", { name: "Create Machine" }));
    expect(screen.getByText("Machine Name is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Machine Name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(machinesApi.create).not.toHaveBeenCalled();
  });
  it("shows backend validation and preserves entered values", async () => {
    vi.mocked(machinesApi.create).mockRejectedValue(
      new ApiError("Check the highlighted fields.", 422, {
        controller: "Enter a valid value.",
      }),
    );
    const user = userEvent.setup();
    open("/machines/new");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Create Machine" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check the highlighted fields",
    );
    expect(screen.getByLabelText("Controller")).toHaveFocus();
    expect(screen.getByLabelText("Machine Name")).toHaveValue(
      " KLS-1840N Demo ",
    );
  });
  it("shows a save failure and re-enables the form", async () => {
    vi.mocked(machinesApi.create).mockRejectedValue(
      new Error("Internal error"),
    );
    const user = userEvent.setup();
    open("/machines/new");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Create Machine" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Machine could not be saved. Try again.",
    );
    expect(
      screen.getByRole("button", { name: "Create Machine" }),
    ).toBeEnabled();
    expect(screen.queryByText("Internal error")).not.toBeInTheDocument();
  });
  it("prevents duplicate creation while saving", async () => {
    vi.mocked(machinesApi.create).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    open("/machines/new");
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Create Machine" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByLabelText("Machine Name")).toBeDisabled();
    expect(machinesApi.create).toHaveBeenCalledTimes(1);
  });
  it("renders persisted Overview fields and five tabs", async () => {
    records.push({ ...fixture });
    open("/machines/machine-1");
    expect(
      await screen.findByRole("heading", { name: fixture.name, level: 1 }),
    ).toBeInTheDocument();
    const overview = screen.getByRole("tabpanel");
    for (const value of [
      fixture.manufacturer,
      fixture.model,
      fixture.controller,
      fixture.notes,
    ])
      expect(within(overview).getByText(value)).toBeInTheDocument();
    expect(within(overview).getByText("Created date")).toBeInTheDocument();
    expect(within(overview).getByText("Last updated date")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
  });
  it("handles a missing machine without showing a demo", async () => {
    open("/machines/missing");
    expect(
      await screen.findByRole("heading", { name: "Machine not found" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
  it("edits a controller and sends only editable fields", async () => {
    records.push({ ...fixture });
    const user = userEvent.setup();
    open("/machines/machine-1");
    await user.click(await screen.findByRole("link", { name: "Edit Machine" }));
    const controller = await screen.findByLabelText("Controller");
    await user.clear(controller);
    await user.type(controller, "FANUC 0i-TF Plus");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(
      await screen.findByRole("heading", { name: fixture.name, level: 1 }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("tabpanel")).getByText("FANUC 0i-TF Plus"),
    ).toBeInTheDocument();
    const sent = vi.mocked(machinesApi.update).mock.calls[0][1];
    expect(Object.keys(sent).sort()).toEqual([
      "controller",
      "machine_type",
      "manufacturer",
      "model",
      "name",
      "notes",
    ]);
  });
  it("cancels an edit without saving", async () => {
    records.push({ ...fixture });
    const user = userEvent.setup();
    open("/machines/machine-1/edit");
    await screen.findByLabelText("Controller");
    await user.click(screen.getByRole("link", { name: "Cancel" }));
    expect(
      await screen.findByRole("heading", { name: fixture.name, level: 1 }),
    ).toBeInTheDocument();
    expect(machinesApi.update).not.toHaveBeenCalled();
  });
  it("requires confirmation before archive", async () => {
    records.push({ ...fixture });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    open("/machines/machine-1");
    await user.click(
      await screen.findByRole("button", { name: "Archive Machine" }),
    );
    expect(window.confirm).toHaveBeenCalled();
    expect(machinesApi.archive).not.toHaveBeenCalled();
  });
  it("archives, filters, restores and returns the same record to Active", async () => {
    records.push({ ...fixture });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    open("/machines/machine-1");
    await user.click(
      await screen.findByRole("button", { name: "Archive Machine" }),
    );
    await screen.findByRole("button", { name: "Restore Machine" });
    await user.click(screen.getByRole("link", { name: "← Machines" }));
    await screen.findByText("No machines have been added yet.");
    await user.click(screen.getByRole("button", { name: "Archived" }));
    await user.click(
      await screen.findByRole("link", { name: `Open ${fixture.name}` }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Restore Machine" }),
    );
    await screen.findByRole("button", { name: "Archive Machine" });
    await user.click(screen.getByRole("link", { name: "← Machines" }));
    expect(
      await screen.findByRole("link", { name: `Open ${fixture.name}` }),
    ).toBeInTheDocument();
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("ACTIVE");
  });
  it("shows both statuses in All", async () => {
    records.push(
      { ...fixture },
      {
        ...fixture,
        id: "machine-2",
        name: "Archived mill",
        status: "ARCHIVED",
      },
    );
    const user = userEvent.setup();
    open();
    await screen.findByRole("link", { name: `Open ${fixture.name}` });
    expect(screen.queryByText("Archived mill")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(await screen.findByText("Archived mill")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(2);
  });
  it("keeps a failed archive visible and retryable", async () => {
    records.push({ ...fixture });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(machinesApi.archive).mockRejectedValue(
      new ApiError("Machine data is temporarily unavailable. Try again.", 503),
    );
    const user = userEvent.setup();
    open("/machines/machine-1");
    await user.click(
      await screen.findByRole("button", { name: "Archive Machine" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "temporarily unavailable",
    );
    expect(
      screen.getByRole("button", { name: "Archive Machine" }),
    ).toBeEnabled();
  });
  it("counts only Active machines on Dashboard", async () => {
    records.push(
      { ...fixture },
      { ...fixture, id: "machine-2", status: "ARCHIVED" },
    );
    open("/dashboard");
    const card = screen.getByText("Machines", {
      selector: ".stat-card > span",
    }).parentElement!;
    await waitFor(() =>
      expect(within(card).getByText("1")).toBeInTheDocument(),
    );
    expect(machinesApi.list).toHaveBeenCalledWith(
      "ACTIVE",
      expect.any(AbortSignal),
    );
    for (const label of [
      "Posts in Development",
      "Needs Attention",
      "Documents",
    ])
      expect(
        within(
          screen.getByText(label, { selector: ".stat-card > span" })
            .parentElement!,
        ).getByText("0"),
      ).toBeInTheDocument();
  });
});
