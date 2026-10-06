import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { machinesApi } from "../api/machines";
import App from "./App";
function open(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}
describe("UI shell", () => {
  beforeEach(() => {
    vi.spyOn(machinesApi, "list").mockResolvedValue([]);
  });
  it("renders the app and exactly four primary navigation links", () => {
    open();
    expect(screen.getByText("G-POST Companion")).toBeInTheDocument();
    const links = within(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Machines",
      "Documents",
      "Post Builder",
    ]);
    expect(
      screen.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeInTheDocument();
  });
  it.each([
    ["/dashboard", "Dashboard"],
    ["/machines", "Machines"],
    ["/documents", "Documents"],
    ["/posts", "Post Builder"],
  ])("renders %s", (route, heading) => {
    open(route);
    expect(
      screen.getByRole("heading", { name: heading, level: 1 }),
    ).toBeInTheDocument();
  });
  it("navigates with the sidebar and dashboard action", async () => {
    const user = userEvent.setup();
    open();
    await user.click(
      within(screen.getByRole("navigation")).getByRole("link", {
        name: "Machines",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Machines", level: 1 }),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("navigation")).getByRole("link", {
        name: "Dashboard",
      }),
    );
    await user.click(screen.getByRole("link", { name: "+ Add Machine" }));
    expect(
      screen.getByRole("heading", { name: "Add Machine", level: 1 }),
    ).toBeInTheDocument();
  });
  it("shows five Machine tabs and supports mouse and keyboard switching", async () => {
    const user = userEvent.setup();
    open("/machines/demo");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Overview",
      "Documents",
      "Machine Profile",
      "Shop Knowledge",
      "Posts",
    ]);
    await user.click(screen.getByRole("tab", { name: "Machine Profile" }));
    expect(
      within(screen.getByRole("tabpanel")).getByText(
        "No machine facts have been confirmed yet.",
      ),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Shop Knowledge" })).toHaveFocus();
    expect(
      screen.getByText("No shop knowledge has been recorded yet."),
    ).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(
      screen.getByText("No Post Records exist for this machine."),
    ).toBeInTheDocument();
    await user.keyboard("{Home}");
    expect(
      screen.getByRole("heading", { name: "Machine Information" }),
    ).toBeInTheDocument();
  });
  it("shows four Post tabs and switches between every placeholder", async () => {
    const user = userEvent.setup();
    open("/posts/demo");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Overview",
      "OFG Configuration",
      "FIL / Custom Logic",
      "Review & Export",
    ]);
    await user.click(screen.getByRole("tab", { name: "OFG Configuration" }));
    expect(screen.getByText("Machine & Axes")).toBeInTheDocument();
    expect(screen.getByText("Operator Messages")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "FIL / Custom Logic" }));
    expect(screen.getByText("No FIL/CIMFIL drafts exist.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Review & Export" }));
    expect(
      screen.getByRole("button", { name: "Export Package" }),
    ).toBeDisabled();
  });
  it("validates the Add Machine form before sending data", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(machinesApi, "create");
    open("/machines/new");
    await user.click(screen.getByRole("button", { name: "Create Machine" }));
    expect(screen.getByText("Machine Name is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Machine Name")).toHaveFocus();
    expect(create).not.toHaveBeenCalled();
  });
  it("keeps upload and extraction unavailable", async () => {
    const user = userEvent.setup();
    const documents = open("/documents");
    expect(
      screen.getByRole("button", { name: "Upload Document" }),
    ).toBeDisabled();
    documents.unmount();
    open("/machines/demo");
    await user.click(screen.getByRole("tab", { name: "Machine Profile" }));
    expect(
      screen.getByRole("button", { name: "Extract Machine Facts" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Add Fact Manually" }),
    ).toBeDisabled();
  });
});
