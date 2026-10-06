import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import EditMachinePage from "../machines/EditMachinePage";
import { machinesApi } from "../../api/machines";
import { beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../../../../backend/app/machine_profiles/definitions.json";
import { machineProfilesApi } from "../../api/machineProfiles";
import { documentsApi } from "../../api/documents";
import { ApiError } from "../../api/client";
import type {
  FactDefinition,
  MachineProfile,
} from "../../types/machineProfile";
import type { DocumentRecord } from "../../types/document";
import MachineProfileTab from "../machines/tabs/MachineProfileTab";

function initialProfile(kind = "Lathe"): MachineProfile {
  const inherited: Record<string, string> = {
    manufacturer: "Test maker",
    model: "Test model",
    machine_type: "Lathe",
    controller: "Test controller",
  };
  return {
    machine_id: "m1",
    categories: catalog.categories,
    summary: {
      confirmed: 0,
      needs_review: 0,
      missing: kind === "Lathe" ? 35 : 36,
    },
    facts: (catalog.definitions as FactDefinition[])
      .filter(
        (d) =>
          d.applicable_machine_types.includes("ALL") ||
          d.applicable_machine_types.includes(kind),
      )
      .map((definition) => ({
        definition,
        applicable: true,
        value: definition.machine_field
          ? inherited[definition.machine_field]
          : null,
        unit: null,
        status: definition.machine_field ? null : "MISSING",
        source_type: definition.machine_field
          ? "MACHINE_RECORD"
          : "PROGRAMMER_ENTRY",
        source_document_id: null,
        source_location: "",
        engineering_notes: "",
        created_at: null,
        updated_at: null,
      })),
  };
}
let store: MachineProfile;
function open(id = "m1") {
  return render(
    <MemoryRouter>
      <MachineProfileTab machineId={id} />
    </MemoryRouter>,
  );
}
async function editSpeed(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Machine & Controller");
  await user.click(screen.getByText("Kinematics & Limits"));
  await user.click(
    screen.getByRole("button", { name: "Maximum Spindle Speed" }),
  );
  await screen.findByRole("option", { name: "None — Programmer entry" });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
  );
}
beforeEach(() => {
  store = initialProfile();
  vi.spyOn(machineProfilesApi, "get").mockImplementation(async () =>
    structuredClone(store),
  );
  vi.spyOn(documentsApi, "list").mockResolvedValue([]);
  vi.spyOn(machineProfilesApi, "save").mockImplementation(
    async (_id, key, input) => {
      const f = store.facts.find((f) => f.definition.key === key)!;
      Object.assign(f, input, {
        source_type: input.source_document_id
          ? "DOCUMENT_REFERENCE"
          : "PROGRAMMER_ENTRY",
        created_at: f.created_at ?? "2026-10-06T12:00:00Z",
        updated_at: "2026-10-06T12:01:00Z",
      });
      store.summary = {
        confirmed: input.status === "CONFIRMED" ? 1 : 0,
        needs_review: input.status === "NEEDS_REVIEW" ? 1 : 0,
        missing: input.status === "MISSING" ? 35 : 34,
      };
      return structuredClone(store);
    },
  );
});
describe("Machine Profile worksheet", () => {
  it("opens facts from their value cell and supports keyboard and back navigation", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Machine & Controller");
    await user.click(screen.getByText("Test model"));
    expect(
      screen.getByRole("heading", { name: "Machine Model" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "← Machine Profile" }));
    const fact = screen.getByRole("button", { name: "Programming Units" });
    fact.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Value")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "← Machine Profile" }));
    expect(screen.getByLabelText("Search profile")).toBeInTheDocument();
    expect(machineProfilesApi.save).not.toHaveBeenCalled();
  });

  it("edits choice and list values using the catalog", async () => {
    const user = userEvent.setup();
    open();
    await user.click(
      await screen.findByRole("button", { name: "Programming Units" }),
    );
    await user.selectOptions(screen.getByLabelText("Value"), "Imperial");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Imperial");
    await user.click(screen.getByText("Modal Rules & Commands"));
    await user.click(screen.getByRole("button", { name: "Supported G-Codes" }));
    await user.type(
      screen.getByLabelText("Value (one item per line)"),
      "G00\nG01",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("G00, G01");
    expect(machineProfilesApi.save).toHaveBeenLastCalledWith(
      "m1",
      "supported_g_codes",
      expect.objectContaining({
        value: ["G00", "G01"],
        status: "NEEDS_REVIEW",
      }),
    );
  });
  it("enters structured rotary axes and can mark their limits Not Applicable", async () => {
    store = initialProfile("Mill");
    const user = userEvent.setup();
    open();
    await screen.findByText("Machine & Controller");
    await user.click(screen.getByText("Kinematics & Limits"));
    await user.click(
      screen.getByRole("button", { name: "Rotary Axis Definition" }),
    );
    await user.click(screen.getByRole("button", { name: "Add rotary axis" }));
    expect(screen.getByLabelText("Minimum angle (deg)")).toHaveValue(null);
    await user.type(screen.getByLabelText("Minimum angle (deg)"), "-90");
    await user.type(screen.getByLabelText("Maximum angle (deg)"), "90");
    await user.click(screen.getByLabelText("Continuous rotation"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("A: -90–90° (continuous)");
    expect(machineProfilesApi.save).toHaveBeenCalledWith(
      "m1",
      "rotary_axis_definition",
      expect.objectContaining({
        value: [
          {
            axis: "A",
            minimum_angle: -90,
            maximum_angle: 90,
            continuous: true,
          },
        ],
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Rotary Axis Definition" }),
    );
    await user.clear(screen.getByLabelText("Minimum angle (deg)"));
    await user.selectOptions(screen.getByLabelText("Status"), "NOT_APPLICABLE");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Not Applicable", { selector: ".badge" });
  });

  it("loads five collapsible categories and live identity without requiring lathe Y/rotary facts", async () => {
    open();
    await screen.findByText("Machine & Controller");
    expect(document.querySelectorAll("details")).toHaveLength(5);
    expect(
      screen.queryByRole("button", { name: "Add Information" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Test maker")).toBeInTheDocument();
    expect(screen.getByText("Test controller")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Y Axis Minimum" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Rotary Axis Definition" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find Information" }),
    ).toBeDisabled();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.queryByText("2026-10-06")).not.toBeInTheDocument();
  });
  it("shows inherited detail with an Edit Machine link and no editable value", async () => {
    const user = userEvent.setup();
    vi.spyOn(machinesApi, "get").mockResolvedValue({
      id: "m1",
      name: "Test machine",
      manufacturer: "Test maker",
      model: "Test model",
      machine_type: "Lathe",
      controller: "Test controller",
      notes: "",
      status: "ACTIVE",
      created_at: "2026-10-06T12:00:00Z",
      updated_at: "2026-10-06T12:00:00Z",
    });
    render(
      <MemoryRouter initialEntries={["/machines/m1"]}>
        <Routes>
          <Route
            path="/machines/:machineId"
            element={<MachineProfileTab machineId="m1" />}
          />
          <Route
            path="/machines/:machineId/edit"
            element={<EditMachinePage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(
      await screen.findByRole("button", { name: "Controller Model" }),
    );
    expect(screen.getByText("Machine Record")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Machine" })).toHaveAttribute(
      "href",
      "/machines/m1/edit",
    );
    expect(
      screen.queryByRole("button", { name: "Save" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Edit Machine" }));
    await screen.findByRole("heading", { name: "Edit Machine" });
    expect(screen.getByLabelText("Controller")).toHaveValue("Test controller");
  });
  it("saves Needs Review by default, updates counts, deliberately confirms, and reloads saved provenance", async () => {
    const user = userEvent.setup();
    const view = open();
    await editSpeed(user);
    expect(screen.getByLabelText("Status")).toHaveValue("NEEDS_REVIEW");
    expect(
      screen.queryByText(
        "Reviewed machine and controller information used during Post development.",
      ),
    ).not.toBeInTheDocument();
    for (const name of ["Profile Value", "Source / Basis", "Engineering Notes"])
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "← Machine Profile" }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Value"), "3000");
    await user.type(
      screen.getByLabelText("Engineering notes"),
      "Reviewed operating limit",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("3000 rpm");
    expect(machineProfilesApi.save).toHaveBeenLastCalledWith(
      "m1",
      "maximum_spindle_speed",
      expect.objectContaining({
        value: 3000,
        unit: "rpm",
        status: "NEEDS_REVIEW",
      }),
    );
    expect(
      within(screen.getByLabelText("Review summary")).getByText("1"),
    ).toBeInTheDocument();
    await editSpeed(user);
    await user.selectOptions(screen.getByLabelText("Status"), "CONFIRMED");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("3000 rpm");
    expect(
      screen.getByText("Confirmed", { selector: ".badge" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 / 6 confirmed")).toBeInTheDocument();
    view.unmount();
    open();
    await editSpeed(user);
    expect(screen.getByLabelText("Engineering notes")).toHaveValue(
      "Reviewed operating limit",
    );
    expect(screen.getByText(/Created/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Future Use" }),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Value"));
    await user.type(screen.getByLabelText("Value"), "2500");
    expect(screen.getByLabelText("Status")).toHaveValue("NEEDS_REVIEW");
  });
  it("updates an existing fact directly from its category", async () => {
    const user = userEvent.setup();
    store.facts.find(
      (f) => f.definition.key === "maximum_spindle_speed",
    )!.value = 2000;
    open();
    await editSpeed(user);
    expect(screen.getByLabelText("Value")).toHaveValue(2000);
    await user.clear(screen.getByLabelText("Value"));
    await user.type(screen.getByLabelText("Value"), "2500");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("2500 rpm");
    expect(
      store.facts.filter((f) => f.definition.key === "maximum_spindle_speed"),
    ).toHaveLength(1);
  });
  it("marks Not Applicable without retaining a value or adding a missing count", async () => {
    const user = userEvent.setup();
    open();
    await editSpeed(user);
    await user.selectOptions(screen.getByLabelText("Status"), "NOT_APPLICABLE");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Not Applicable", { selector: ".badge" });
    expect(machineProfilesApi.save).toHaveBeenCalledWith(
      "m1",
      "maximum_spindle_speed",
      expect.objectContaining({
        value: null,
        unit: null,
        status: "NOT_APPLICABLE",
      }),
    );
    expect(screen.getByText("34")).toBeInTheDocument();
  });
  it("searches without showing raw metadata and Cancel leaves values untouched", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Machine & Controller");
    await user.type(screen.getByLabelText("Search profile"), "spindle speed");
    expect(
      screen.getByRole("button", { name: "Maximum Spindle Speed" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Machine Model" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Maximum Spindle Speed" }),
    );
    await user.type(screen.getByLabelText("Value"), "3000");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(machineProfilesApi.save).not.toHaveBeenCalled();
  });
  it("requires a usable value before confirmation and retains draft after server errors", async () => {
    const user = userEvent.setup();
    vi.mocked(machineProfilesApi.save).mockRejectedValue(
      new ApiError("Select an allowed unit.", 422),
    );
    open();
    await editSpeed(user);
    await user.selectOptions(screen.getByLabelText("Status"), "CONFIRMED");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a value");
    expect(machineProfilesApi.save).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Value"), "3000");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Select an allowed unit.");
    expect(screen.getByLabelText("Value")).toHaveValue(3000);
  });
  it("references uploaded documents explicitly and preserves location and notes", async () => {
    const user = userEvent.setup();
    vi.mocked(documentsApi.list).mockResolvedValue([
      {
        id: "d1",
        title: "Machine manual",
        status: "ARCHIVED",
      } as DocumentRecord,
    ]);
    open();
    await editSpeed(user);
    await user.type(screen.getByLabelText("Value"), "3000");
    await user.selectOptions(
      screen.getByLabelText("Supporting Document (optional)"),
      "d1",
    );
    await user.type(screen.getByLabelText("Source location / Page"), "Page 42");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("3000 rpm");
    expect(machineProfilesApi.save).toHaveBeenCalledWith(
      "m1",
      "maximum_spindle_speed",
      expect.objectContaining({
        source_document_id: "d1",
        source_location: "Page 42",
        status: "NEEDS_REVIEW",
      }),
    );
  });
  it("offers retry on profile load failure", async () => {
    const user = userEvent.setup();
    vi.mocked(machineProfilesApi.get).mockRejectedValueOnce(
      new ApiError("Service unavailable", 503),
    );
    open();
    await screen.findByText("Service unavailable");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Machine & Controller");
  });
  it("blocks save on a failed source list and allows retry without losing the draft", async () => {
    const user = userEvent.setup();
    vi.mocked(documentsApi.list).mockRejectedValueOnce(
      new ApiError("Documents unavailable", 503),
    );
    open();
    await screen.findByText("Machine & Controller");
    await user.click(screen.getByText("Kinematics & Limits"));
    await user.click(
      screen.getByRole("button", { name: "Maximum Spindle Speed" }),
    );
    await screen.findByText("Documents unavailable");
    await user.type(screen.getByLabelText("Value"), "3000");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Retry source documents" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
    );
    expect(screen.getByLabelText("Value")).toHaveValue(3000);
  });
  it("does not load or save an unsaved demo profile", async () => {
    open("demo");
    expect(
      screen.queryByRole("button", { name: "Add Information" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find Information" }),
    ).toBeDisabled();
    expect(machineProfilesApi.get).not.toHaveBeenCalled();
  });
});
