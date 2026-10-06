import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, it, expect, vi } from "vitest";
import catalog from "../../../../backend/app/machine_profiles/definitions.json";
import rules from "../../../../backend/app/profile_extraction/rules.json";
import { machineProfilesApi } from "../../api/machineProfiles";
import { profileExtractionApi } from "../../api/profileExtraction";
import { ApiError } from "../../api/client";
import type {
  FactDefinition,
  MachineProfile,
} from "../../types/machineProfile";
import type {
  ExtractionDocument,
  ExtractionRun,
  ProposedFactCandidate,
} from "../../types/profileExtraction";
import MachineProfileTab from "../machines/tabs/MachineProfileTab";
let profile: MachineProfile;
const docs: ExtractionDocument[] = [
  {
    id: "d1",
    machine_id: "m1",
    machine_name: "Test",
    title: "Machine reference",
    document_type: "MACHINE_MANUAL",
    original_filename: "reference.pdf",
    storage_key: "fixture.pdf",
    file_type: "PDF",
    file_size: 1000,
    description: "",
    status: "ACTIVE",
    created_at: "date",
    updated_at: "date",
    processing_state: "READY",
  },
  {
    id: "d2",
    machine_id: "m1",
    machine_name: "Test",
    title: "Controller reference",
    document_type: "CONTROLLER_MANUAL",
    original_filename: "control.pdf",
    storage_key: "fixture.pdf",
    file_type: "PDF",
    file_size: 1000,
    description: "",
    status: "ACTIVE",
    created_at: "date",
    updated_at: "date",
    processing_state: "PARTIAL",
  },
];
const candidate: ProposedFactCandidate = {
  id: "c1",
  run_id: "r1",
  machine_id: "m1",
  fact_key: "maximum_spindle_speed",
  kind: "VALUE",
  candidate_value: 4000,
  candidate_unit: "rpm",
  document_id: "d1",
  document_title: "Machine reference",
  file_type: "PDF",
  page_number: 72,
  evidence_text: "Maximum spindle speed .... 4,000 rev/min",
  match_method: "PHRASE_VALUE",
  status: "PROPOSED",
  created_at: "2026-10-06T12:00:00Z",
  reviewed_at: null,
};
let run: ExtractionRun;
function open() {
  return render(
    <MemoryRouter>
      <MachineProfileTab machineId="m1" />
    </MemoryRouter>,
  );
}
async function start(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: "Find Information" }),
  );
  await screen.findByRole("checkbox", {
    name: "Maximum Spindle Speed Current: 3500 rpm",
  });
}
async function selectDocuments(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("checkbox", {
      name: "Maximum Spindle Speed Current: 3500 rpm",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Select Documents" });
  await user.click(
    screen.getByRole("checkbox", {
      name: "Machine reference Machine Manual · Ready",
    }),
  );
}
async function results(user: ReturnType<typeof userEvent.setup>) {
  await start(user);
  await selectDocuments(user);
  await user.click(screen.getByRole("button", { name: "Find Information" }));
  await screen.findByRole("heading", { name: "Find Information Results" });
}
beforeEach(() => {
  profile = {
    machine_id: "m1",
    categories: catalog.categories,
    summary: { confirmed: 1, needs_review: 0, missing: 34 },
    facts: (catalog.definitions as FactDefinition[])
      .filter(
        (d) =>
          d.applicable_machine_types.includes("ALL") ||
          d.applicable_machine_types.includes("Lathe"),
      )
      .map((d) => ({
        definition: {
          ...d,
          extraction: d.key in rules ? { eligible: true } : undefined,
        },
        applicable: true,
        value:
          d.key === "maximum_spindle_speed"
            ? 3500
            : d.machine_field
              ? "Test identity"
              : null,
        unit: d.key === "maximum_spindle_speed" ? "rpm" : null,
        status: d.machine_field
          ? null
          : d.key === "maximum_spindle_speed"
            ? "CONFIRMED"
            : "MISSING",
        source_type: d.machine_field ? "MACHINE_RECORD" : "PROGRAMMER_ENTRY",
        source_document_id: null,
        source_location: "",
        engineering_notes: "",
        created_at: null,
        updated_at: d.key === "maximum_spindle_speed" ? "original-date" : null,
      })),
  };
  run = {
    id: "r1",
    machine_id: "m1",
    selected_fact_keys: ["maximum_spindle_speed"],
    selected_document_ids: ["d1"],
    documents: [docs[0]],
    started_at: candidate.created_at,
    completed_at: candidate.created_at,
    results: [
      {
        fact_key: "maximum_spindle_speed",
        display_name: "Maximum Spindle Speed",
        state: "CANDIDATE_FOUND",
        message: "Review the candidate evidence before applying.",
        warnings: [],
        candidates: [structuredClone(candidate)],
      },
    ],
  };
  vi.spyOn(machineProfilesApi, "get").mockImplementation(async () =>
    structuredClone(profile),
  );
  vi.spyOn(profileExtractionApi, "documents").mockResolvedValue(docs);
  vi.spyOn(profileExtractionApi, "candidates").mockResolvedValue(null);
  vi.spyOn(profileExtractionApi, "find").mockImplementation(async () =>
    structuredClone(run),
  );
  vi.spyOn(profileExtractionApi, "apply").mockImplementation(async () => {
    const f = profile.facts.find(
      (f) => f.definition.key === "maximum_spindle_speed",
    )!;
    Object.assign(f, {
      value: 4000,
      unit: "rpm",
      status: "NEEDS_REVIEW",
      source_type: "DOCUMENT_REFERENCE",
      source_document_id: "d1",
      source_location: "PDF page 72",
      updated_at: "new-date",
    });
    profile.summary = { confirmed: 0, needs_review: 1, missing: 34 };
    run.results[0].candidates[0].status = "APPLIED";
    return { run: structuredClone(run), profile: structuredClone(profile) };
  });
  vi.spyOn(profileExtractionApi, "reject").mockImplementation(async () => {
    run.results[0].candidates[0].status = "REJECTED";
    return { run: structuredClone(run), profile: structuredClone(profile) };
  });
});
describe("Targeted Find Information", () => {
  it("starts from the profile action and only offers eligible applicable editable facts", async () => {
    const user = userEvent.setup();
    open();
    await start(user);
    expect(
      screen.queryByRole("checkbox", { name: /Machine Manufacturer/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /Y Axis Minimum/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /Tool Change Behavior/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /Supported G-Codes/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
  it("multi-selects facts and prepared sources in two simple steps", async () => {
    const user = userEvent.setup();
    open();
    await start(user);
    await user.click(
      screen.getByRole("checkbox", { name: /Maximum Spindle Speed/ }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: "Maximum Feedrate" }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(
      screen.getByRole("checkbox", { name: /Machine reference/ }),
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Controller reference/ }),
    );
    await user.click(screen.getByRole("button", { name: "Find Information" }));
    await screen.findByRole("heading", { name: "Find Information Results" });
    expect(profileExtractionApi.find).toHaveBeenCalledWith(
      "m1",
      ["maximum_spindle_speed", "maximum_feedrate"],
      ["d1", "d2"],
    );
  });
  it("shows a clear empty-source message without preparing documents automatically", async () => {
    vi.mocked(profileExtractionApi.documents).mockResolvedValue([]);
    const user = userEvent.setup();
    open();
    await start(user);
    await user.click(
      screen.getByRole("checkbox", { name: /Maximum Spindle Speed/ }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByText("No prepared documents are available for this machine."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Documents" }),
    ).toHaveAttribute("href", "/documents");
    expect(
      screen.getByRole("button", { name: "Find Information" }),
    ).toBeDisabled();
  });
  it("keeps candidates separate while displaying current value, evidence, source and page", async () => {
    const user = userEvent.setup();
    open();
    await results(user);
    expect(screen.getByText("3500 rpm")).toBeInTheDocument();
    expect(screen.getByText("4000 rpm")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.queryByText(candidate.evidence_text)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open Source" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show Evidence" }));
    expect(screen.getByText(candidate.evidence_text)).toBeInTheDocument();
    expect(screen.getAllByText(/PDF page 72/)).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Open Source" })).toHaveAttribute(
      "href",
      "/api/documents/d1/file#page=72",
    );
    expect(profileExtractionApi.apply).not.toHaveBeenCalled();
    expect(
      profile.facts.find((f) => f.definition.key === "maximum_spindle_speed")!
        .value,
    ).toBe(3500);
  });
  it("shows all conflicting candidates without silently selecting one", async () => {
    run.results[0].state = "MULTIPLE_CANDIDATES_FOUND";
    run.results[0].candidates.push({
      ...candidate,
      id: "c2",
      document_id: "d2",
      document_title: "Controller reference",
      candidate_value: 6000,
      page_number: 411,
    });
    const user = userEvent.setup();
    open();
    await results(user);
    expect(screen.getByText("Multiple Candidates")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Apply" })).toHaveLength(2);
    expect(screen.getByText("6000 rpm")).toBeInTheDocument();
  });
  it("groups normalized equal values across sources with evidence collapsed", async () => {
    run.results[0].state = "MULTIPLE_CANDIDATES_FOUND";
    run.results[0].candidates.push(
      {
        ...candidate,
        id: "c2",
        document_id: "d2",
        document_title: "Quick reference",
        file_type: "TXT",
        page_number: 1,
        evidence_text: "Maximum spindle speed: 4000 RPM",
      },
      {
        ...candidate,
        id: "c3",
        document_id: "d3",
        document_title: "Scanned spec",
        page_number: 1,
        evidence_text: "Max spindle speed: 4,000 rpm",
      },
    );
    const user = userEvent.setup();
    open();
    await results(user);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("1 Candidate")).toBeInTheDocument();
    expect(screen.getByText("3 supporting sources")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list")).getByText(
        "Quick reference · Text section 1",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("list")).getByText("Scanned spec · PDF page 1"),
    ).toBeInTheDocument();
    for (const c of run.results[0].candidates)
      expect(screen.queryByText(c.evidence_text)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Open Source" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Show Evidence" }));
    for (const c of run.results[0].candidates)
      expect(screen.getByText(c.evidence_text)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Open Source" })
        .map((a) => a.getAttribute("href")),
    ).toEqual([
      "/api/documents/d1/file#page=72",
      "/api/documents/d2/file",
      "/api/documents/d3/file#page=1",
    ]);
    await user.click(screen.getByRole("button", { name: "Hide Evidence" }));
    expect(screen.queryByText(candidate.evidence_text)).not.toBeInTheDocument();
    expect(profileExtractionApi.apply).not.toHaveBeenCalled();
  });
  it("keeps units and typed normalized values distinct", async () => {
    run.results[0].candidates.push(
      { ...candidate, id: "c2", candidate_unit: "mm" },
      { ...candidate, id: "c3", candidate_value: "4000" },
    );
    const user = userEvent.setup();
    open();
    await results(user);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText("Multiple Candidates")).toBeInTheDocument();
    expect(screen.getByText(/Sources disagree/)).toBeInTheDocument();
  });
  it.each([
    {
      key: "programming_units",
      name: "Programming Units",
      value: "Imperial",
      display: "Imperial",
    },
    {
      key: "linear_axes",
      name: "Linear Axes",
      value: ["X", "Z"],
      display: "X, Z",
    },
  ])(
    "groups normalized $name values without changing source records",
    async ({ key, name, value, display }) => {
      run.results[0].fact_key = key;
      run.results[0].display_name = name;
      run.results[0].candidates = [
        {
          ...candidate,
          fact_key: key,
          candidate_value: value,
          candidate_unit: null,
        },
        {
          ...candidate,
          id: "c2",
          fact_key: key,
          candidate_value: structuredClone(value),
          candidate_unit: null,
          document_id: "d2",
          document_title: "Quick reference",
        },
      ];
      const original = structuredClone(run.results[0].candidates);
      const user = userEvent.setup();
      open();
      await results(user);
      expect(screen.getAllByRole("article")).toHaveLength(1);
      expect(
        screen.getByRole("heading", { name: display }),
      ).toBeInTheDocument();
      expect(screen.getByText("2 supporting sources")).toBeInTheDocument();
      expect(run.results[0].candidates).toEqual(original);
    },
  );
  it("applies only the explicitly chosen source in a grouped value and preserves its provenance", async () => {
    run.results[0].candidates.push({
      ...candidate,
      id: "c2",
      document_id: "d2",
      document_title: "Quick reference",
      file_type: "TXT",
      page_number: 1,
    });
    vi.mocked(profileExtractionApi.apply).mockImplementationOnce(async (id) => {
      const chosen = run.results[0].candidates.find((c) => c.id === id)!;
      chosen.status = "APPLIED";
      const fact = profile.facts.find(
        (f) => f.definition.key === chosen.fact_key,
      )!;
      Object.assign(fact, {
        value: chosen.candidate_value,
        unit: chosen.candidate_unit,
        status: "NEEDS_REVIEW",
        source_type: "DOCUMENT_REFERENCE",
        source_document_id: chosen.document_id,
        source_location: "Text section 1",
        updated_at: "new-date",
      });
      return { run: structuredClone(run), profile: structuredClone(profile) };
    });
    const user = userEvent.setup();
    open();
    await results(user);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Primary source" }),
      "c2",
    );
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("Applied");
    expect(profileExtractionApi.apply).toHaveBeenCalledExactlyOnceWith(
      "c2",
      "m1",
      "original-date",
    );
    const fact = profile.facts.find(
      (f) => f.definition.key === "maximum_spindle_speed",
    )!;
    expect(fact.source_document_id).toBe("d2");
    expect(fact.source_location).toBe("Text section 1");
    expect(fact.status).toBe("NEEDS_REVIEW");
    expect(run.results[0].candidates[0].status).toBe("PROPOSED");
    expect(run.results[0].candidates[1].evidence_text).toBe(
      candidate.evidence_text,
    );
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });
  it("rejects only the selected source while keeping other equal-value candidates reviewable", async () => {
    run.results[0].candidates.push({
      ...candidate,
      id: "c2",
      document_id: "d2",
      document_title: "Quick reference",
    });
    vi.mocked(profileExtractionApi.reject).mockImplementationOnce(
      async (id) => {
        run.results[0].candidates.find((c) => c.id === id)!.status = "REJECTED";
        return { run: structuredClone(run), profile: structuredClone(profile) };
      },
    );
    const user = userEvent.setup();
    open();
    await results(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Primary source" }),
      "c2",
    );
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await screen.findByText("Rejected");
    expect(profileExtractionApi.reject).toHaveBeenCalledExactlyOnceWith(
      "c2",
      "m1",
    );
    expect(screen.getByText("3500 rpm")).toBeInTheDocument();
    expect(run.results[0].candidates[0].status).toBe("PROPOSED");
    expect(
      screen.getByText("1 supporting source · 1 rejected source"),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Primary source" }),
      "c1",
    );
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });
  it("handles no information and related evidence without an Apply action", async () => {
    run.results.push({
      fact_key: "maximum_feedrate",
      display_name: "Maximum Feedrate",
      state: "NO_INFORMATION_FOUND",
      message: "No matching information found in the selected documents.",
      warnings: [],
      candidates: [],
    });
    run.results[0].state = "RELATED_EVIDENCE_ONLY";
    run.results[0].candidates = [
      {
        ...candidate,
        kind: "RELATED_EVIDENCE",
        candidate_value: null,
        candidate_unit: null,
        evidence_text: "Spindle specification unavailable.",
      },
    ];
    const user = userEvent.setup();
    open();
    await results(user);
    expect(screen.getByText("No Information Found")).toBeInTheDocument();
    expect(screen.getByText("Related Evidence Only")).toBeInTheDocument();
    expect(screen.getByText("Related Evidence (1)")).toBeInTheDocument();
    expect(
      screen.queryByText("Spindle specification unavailable."),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(
      screen.getByText("Spindle specification unavailable."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Source" })).toHaveAttribute(
      "href",
      "/api/documents/d1/file#page=72",
    );
    await user.click(screen.getByRole("button", { name: "Reject Source" }));
    await screen.findByText(/Rejected/);
    expect(profileExtractionApi.reject).toHaveBeenCalledWith("c1", "m1");
    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
  });
  it("applies explicitly, updates comparison/counts, and returns a Needs Review value", async () => {
    const user = userEvent.setup();
    open();
    await results(user);
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("Applied");
    expect(profileExtractionApi.apply).toHaveBeenCalledWith(
      "c1",
      "m1",
      "original-date",
    );
    expect(screen.getByText("Needs Review")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "← Machine Profile" }));
    expect(screen.getByText("4000 rpm")).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Review summary" })).getByText(
        "1",
      ),
    ).toBeInTheDocument();
    expect(
      profile.facts.find((f) => f.definition.key === "maximum_spindle_speed")!
        .source_location,
    ).toBe("PDF page 72");
  });
  it("rejects while retaining the candidate and leaving the profile unchanged", async () => {
    const user = userEvent.setup();
    open();
    await results(user);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await screen.findByText("Rejected");
    expect(profileExtractionApi.reject).toHaveBeenCalledWith("c1", "m1");
    expect(screen.getByText("3500 rpm")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Apply" }),
    ).not.toBeInTheDocument();
  });
  it("shows loading and disables repeated searches", async () => {
    let resolve!: (r: ExtractionRun) => void;
    vi.mocked(profileExtractionApi.find).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const user = userEvent.setup();
    open();
    await start(user);
    await selectDocuments(user);
    await user.click(screen.getByRole("button", { name: "Find Information" }));
    expect(
      screen.getByRole("button", { name: "Finding Information…" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Searching selected prepared pages locally",
    );
    await act(async () => resolve(run));
    await screen.findByRole("heading", { name: "Find Information Results" });
  });
  it("shows source selection errors and allows refresh", async () => {
    vi.mocked(profileExtractionApi.documents).mockRejectedValueOnce(
      new ApiError("References unavailable", 503),
    );
    const user = userEvent.setup();
    open();
    await user.click(
      await screen.findByRole("button", { name: "Find Information" }),
    );
    await screen.findByText("References unavailable");
    await user.click(
      screen.getByRole("button", { name: "Refresh References" }),
    );
    await screen.findByRole("checkbox", { name: /Maximum Spindle Speed/ });
  });
  it("keeps selections and current profile intact after a search failure", async () => {
    vi.mocked(profileExtractionApi.find).mockRejectedValue(
      new ApiError("Select active prepared references.", 422),
    );
    const user = userEvent.setup();
    open();
    await start(user);
    await selectDocuments(user);
    await user.click(screen.getByRole("button", { name: "Find Information" }));
    await screen.findByText("Select active prepared references.");
    expect(
      screen.getByRole("checkbox", { name: /Machine reference/ }),
    ).toBeChecked();
    expect(profileExtractionApi.apply).not.toHaveBeenCalled();
  });
  it("refreshes a stale comparison before the engineer retries Apply", async () => {
    vi.mocked(profileExtractionApi.apply).mockRejectedValueOnce(
      new ApiError("The current profile value changed.", 409),
    );
    vi.mocked(profileExtractionApi.candidates).mockImplementation(
      async (_id, runId) => (runId ? run : null),
    );
    const user = userEvent.setup();
    open();
    await results(user);
    await user.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByText("The current profile value changed.");
    profile.facts.find(
      (f) => f.definition.key === "maximum_spindle_speed",
    )!.value = 3600;
    await user.click(
      screen.getByRole("button", { name: "Refresh Current Values" }),
    );
    await screen.findByText("3600 rpm");
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
  });
  it("clears selected documents that become unavailable after refresh", async () => {
    const user = userEvent.setup();
    open();
    await start(user);
    await selectDocuments(user);
    vi.mocked(profileExtractionApi.documents).mockResolvedValue([docs[1]]);
    await user.click(
      screen.getByRole("button", { name: "Refresh References" }),
    );
    await screen.findByRole("checkbox", { name: /Controller reference/ });
    expect(
      screen.queryByRole("checkbox", { name: /Machine reference/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Find Information" }),
    ).toBeDisabled();
  });
  it("reopens the latest saved review results and preserves statuses", async () => {
    run.results[0].candidates[0].status = "REJECTED";
    vi.mocked(profileExtractionApi.candidates).mockResolvedValue(run);
    const user = userEvent.setup();
    open();
    await start(user);
    await user.click(
      screen.getByRole("button", { name: "Review Last Results" }),
    );
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(profileExtractionApi.find).not.toHaveBeenCalled();
  });
});
