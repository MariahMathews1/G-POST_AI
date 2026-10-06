import { useEffect, useState } from "react";
import { machineProfilesApi } from "../../../api/machineProfiles";
import {
  factStatuses,
  type MachineProfile,
  type ProfileFact,
} from "../../../types/machineProfile";
import FactEditor from "../../machineProfiles/FactEditor";

function displayValue(fact: ProfileFact) {
  if (fact.value === null) return "—";
  if (fact.definition.value_type === "rotary_axes" && Array.isArray(fact.value))
    return (
      fact.value as {
        axis: string;
        minimum_angle: number;
        maximum_angle: number;
        continuous: boolean;
      }[]
    )
      .map(
        (a) =>
          `${a.axis}: ${a.minimum_angle}–${a.maximum_angle}°${a.continuous ? " (continuous)" : ""}`,
      )
      .join("; ");
  const value = Array.isArray(fact.value)
    ? fact.value.join(", ")
    : String(fact.value);
  return `${value}${fact.unit ? ` ${fact.unit}` : ""}`;
}
export default function MachineProfileTab({
  machineId,
}: {
  machineId: string;
}) {
  const [profile, setProfile] = useState<MachineProfile | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    identity: true,
  });
  const [selected, setSelected] = useState<ProfileFact | null>(null);
  useEffect(() => {
    if (machineId === "demo") return;
    const controller = new AbortController();
    machineProfilesApi
      .get(machineId, controller.signal)
      .then(setProfile)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [machineId, attempt]);
  const categories = [...(profile?.categories ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const facts = [...(profile?.facts ?? [])].sort(
    (a, b) => a.definition.display_order - b.definition.display_order,
  );
  const filtered = facts.filter((f) =>
    `${f.definition.display_name} ${displayValue(f)} ${f.status ? factStatuses[f.status] : "Machine Record"}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const actions = (
    <>
      <div className="actions">
        <button
          className="button"
          disabled
          aria-describedby="find-information-help"
        >
          Find Information
        </button>
      </div>
      <p className="helper" id="find-information-help">
        Document search will be added in a later sprint.
      </p>
    </>
  );
  if (selected)
    return (
      <FactEditor
        key={selected.definition.key}
        machineId={machineId}
        fact={selected}
        category={
          categories.find((c) => c.key === selected.definition.category)
            ?.display_name ?? ""
        }
        onCancel={() => setSelected(null)}
        onSaved={(p) => {
          setProfile(p);
          setExpanded((previous) => ({
            ...previous,
            [selected.definition.category]: true,
          }));
          setSelected(null);
        }}
      />
    );
  return (
    <>
      <div className="section-header">
        <div>
          <h2>Machine Profile</h2>
          <p>
            Reviewed machine and controller information used during Post
            development.
          </p>
        </div>
      </div>

      {machineId === "demo" ? (
        <>
          {actions}
          <p className="notice">
            Save a Machine to enter and review its profile information.
          </p>
        </>
      ) : error ? (
        <div>
          <p role="alert">{error}</p>
          <button
            className="button"
            onClick={() => {
              setError("");
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : !profile ? (
        <p role="status">Loading machine profile…</p>
      ) : (
        <>
          <div
            className="profile-summary"
            role="group"
            aria-label="Review summary"
            aria-describedby="profile-count-help"
          >
            <span>
              <strong>{profile.summary.confirmed}</strong> Confirmed
            </span>
            <span>
              <strong>{profile.summary.needs_review}</strong> Needs Review
            </span>
            <span title="Missing counts normally important, applicable information. Machine record values and Not Applicable information are excluded.">
              <strong>{profile.summary.missing}</strong> Missing
            </span>
          </div>
          <p className="profile-visually-hidden" id="profile-count-help">
            Missing counts normally important, applicable information. Machine
            record values and Not Applicable information are excluded from
            review counts.
          </p>
          <div className="profile-toolbar">
            <div className="form-field profile-search">
              <label htmlFor="profile-search">Search profile</label>
              <input
                id="profile-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, value, or status"
              />
            </div>
            <div className="profile-find">{actions}</div>
          </div>
          {filtered.length === 0 && <p>No information matches your search.</p>}
          <div className="profile-sections">
            {categories.map((c) => {
              const rows = filtered.filter(
                (f) => f.definition.category === c.key,
              );
              return (
                <details
                  className="panel profile-category"
                  key={c.key}
                  open={query ? true : !!expanded[c.key]}
                  onToggle={(event) => {
                    const open = event.currentTarget.open;
                    if (!query)
                      setExpanded((previous) =>
                        previous[c.key] === open
                          ? previous
                          : { ...previous, [c.key]: open },
                      );
                  }}
                >
                  <summary>
                    <span className="profile-category-name">
                      {c.display_name}
                    </span>
                    <span className="profile-category-progress">
                      {
                        facts.filter(
                          (f) =>
                            f.definition.category === c.key &&
                            f.status === "CONFIRMED",
                        ).length
                      }{" "}
                      /{" "}
                      {
                        facts.filter(
                          (f) =>
                            f.definition.category === c.key &&
                            f.status !== null &&
                            f.status !== "NOT_APPLICABLE",
                        ).length
                      }{" "}
                      confirmed
                    </span>
                  </summary>
                  <div className="profile-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Information</th>
                          <th>Value</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((f) => (
                          <tr
                            key={f.definition.key}
                            onClick={() => setSelected(f)}
                          >
                            <td>
                              <button className="profile-fact-link">
                                {f.definition.display_name}
                              </button>
                            </td>
                            <td className="profile-value">{displayValue(f)}</td>
                            <td>
                              <span
                                className={`badge profile-status-${f.status?.toLowerCase() ?? "inherited"}`}
                              >
                                {f.status
                                  ? factStatuses[f.status]
                                  : "Machine Record"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!rows.length && (
                      <p className="helper">
                        No matching information in this category.
                      </p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
