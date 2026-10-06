import { useEffect, useState } from "react";
import { Link } from "react-router";
import { documentsApi } from "../../api/documents";
import { machineProfilesApi } from "../../api/machineProfiles";
import type { DocumentRecord } from "../../types/document";
import {
  factStatuses,
  type FactStatus,
  type ProfileFact,
  type MachineProfile,
  type RotaryAxis,
} from "../../types/machineProfile";

type RotaryAxisDraft = Omit<RotaryAxis, "minimum_angle" | "maximum_angle"> & {
  minimum_angle: number | "";
  maximum_angle: number | "";
};

export default function FactEditor({
  machineId,
  fact,
  category,
  onCancel,
  onSaved,
}: {
  machineId: string;
  fact: ProfileFact;
  category: string;
  onCancel: () => void;
  onSaved: (profile: MachineProfile) => void;
}) {
  const d = fact.definition;
  const inherited = !!d.machine_field;
  const [text, setText] = useState(
    Array.isArray(fact.value)
      ? d.value_type === "list"
        ? fact.value.join("\n")
        : ""
      : String(fact.value ?? ""),
  );
  const [axes, setAxes] = useState<RotaryAxisDraft[]>(
    d.value_type === "rotary_axes" && Array.isArray(fact.value)
      ? (fact.value as RotaryAxis[])
      : [],
  );
  const [unit, setUnit] = useState(fact.unit ?? d.allowed_units[0] ?? "");
  const [status, setStatus] = useState<FactStatus>(
    fact.status === "CONFIRMED" || fact.status === "NOT_APPLICABLE"
      ? fact.status
      : "NEEDS_REVIEW",
  );
  const [documentId, setDocumentId] = useState(fact.source_document_id ?? "");
  const [location, setLocation] = useState(fact.source_location);
  const [notes, setNotes] = useState(fact.engineering_notes);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentError, setDocumentError] = useState("");
  const [documentLoading, setDocumentLoading] = useState(!inherited);
  const [documentAttempt, setDocumentAttempt] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (inherited) return;
    const controller = new AbortController();
    documentsApi
      .list({ machine_id: machineId }, controller.signal)
      .then(setDocuments)
      .catch((e: Error) => {
        if (!controller.signal.aborted) setDocumentError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDocumentLoading(false);
      });
    return () => controller.abort();
  }, [machineId, inherited, documentAttempt]);
  function edited() {
    setStatus("NEEDS_REVIEW");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const empty = status === "MISSING" || status === "NOT_APPLICABLE";
    if (!empty && d.value_type !== "rotary_axes" && !text.trim()) {
      setError(
        "Enter a value before requesting review or confirming information.",
      );
      return;
    }
    if (
      !empty &&
      d.value_type === "rotary_axes" &&
      (!axes.length ||
        axes.some(
          (axis) => axis.minimum_angle === "" || axis.maximum_angle === "",
        ))
    ) {
      setError("Enter the minimum and maximum angle for each rotary axis.");
      return;
    }
    const value = empty
      ? null
      : d.value_type === "rotary_axes"
        ? axes.map((axis) => ({
            ...axis,
            minimum_angle: Number(axis.minimum_angle),
            maximum_angle: Number(axis.maximum_angle),
          }))
        : d.value_type === "list"
          ? text
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : ["number", "integer"].includes(d.value_type)
            ? Number(text)
            : text.trim();
    setSaving(true);
    try {
      onSaved(
        await machineProfilesApi.save(machineId, d.key, {
          value,
          unit: empty ? null : unit || null,
          status,
          source_document_id: documentId || null,
          source_location: location,
          engineering_notes: notes,
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Information could not be saved. Try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="profile-editor">
      <button
        type="button"
        className="profile-back"
        onClick={onCancel}
        disabled={saving}
      >
        ← Machine Profile
      </button>
      <header className="profile-fact-header">
        <h2>{d.display_name}</h2>
        <p className="profile-fact-category">{category}</p>
        <p className="profile-fact-description">{d.description}</p>
      </header>
      {!fact.applicable && (
        <p className="notice">
          This saved information is outside the current machine type’s usual
          worksheet. Review its applicability.
        </p>
      )}
      {inherited ? (
        <div className="panel padded profile-inherited">
          <dl className="identity-grid">
            <div>
              <dt>Value</dt>
              <dd>{String(fact.value)}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>Machine Record</dd>
            </div>
          </dl>
          <p className="helper">
            This value is maintained in Machine Overview.
          </p>
          <Link className="button" to={`/machines/${machineId}/edit`}>
            Edit Machine
          </Link>
        </div>
      ) : (
        <form className="machine-form panel profile-edit-form" onSubmit={save}>
          <fieldset disabled={saving}>
            <section
              className="profile-form-section"
              aria-labelledby="profile-value-heading"
            >
              <h3 id="profile-value-heading">Profile Value</h3>
              <fieldset
                className={`profile-value-fields profile-value-${d.value_type}`}
                disabled={status === "MISSING" || status === "NOT_APPLICABLE"}
              >
                <div className="form-field">
                  <label htmlFor="fact-value">
                    Value{d.value_type === "list" ? " (one item per line)" : ""}
                  </label>
                  {d.value_type === "rotary_axes" ? (
                    <div id="fact-value" className="rotary-fields">
                      <p className="helper">
                        Angles are in degrees. Enter only reviewed axis limits.
                      </p>
                      {axes.map((axis, i) => (
                        <fieldset key={i} className="rotary-axis">
                          <legend>Rotary axis {i + 1}</legend>
                          <label>
                            Axis{" "}
                            <select
                              value={axis.axis}
                              onChange={(e) => {
                                setAxes(
                                  axes.map((a, j) =>
                                    j === i
                                      ? {
                                          ...a,
                                          axis: e.target
                                            .value as RotaryAxis["axis"],
                                        }
                                      : a,
                                  ),
                                );
                                edited();
                              }}
                            >
                              {["A", "B", "C"].map((a) => (
                                <option key={a}>{a}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Minimum angle (deg){" "}
                            <input
                              type="number"
                              step="any"
                              value={axis.minimum_angle}
                              onChange={(e) => {
                                setAxes(
                                  axes.map((a, j) =>
                                    j === i
                                      ? {
                                          ...a,
                                          minimum_angle:
                                            e.target.value === ""
                                              ? ""
                                              : Number(e.target.value),
                                        }
                                      : a,
                                  ),
                                );
                                edited();
                              }}
                              required
                            />
                          </label>
                          <label>
                            Maximum angle (deg){" "}
                            <input
                              type="number"
                              step="any"
                              value={axis.maximum_angle}
                              onChange={(e) => {
                                setAxes(
                                  axes.map((a, j) =>
                                    j === i
                                      ? {
                                          ...a,
                                          maximum_angle:
                                            e.target.value === ""
                                              ? ""
                                              : Number(e.target.value),
                                        }
                                      : a,
                                  ),
                                );
                                edited();
                              }}
                              required
                            />
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={axis.continuous}
                              onChange={(e) => {
                                setAxes(
                                  axes.map((a, j) =>
                                    j === i
                                      ? { ...a, continuous: e.target.checked }
                                      : a,
                                  ),
                                );
                                edited();
                              }}
                            />{" "}
                            Continuous rotation
                          </label>
                          <button
                            type="button"
                            className="button"
                            onClick={() => {
                              setAxes(axes.filter((_, j) => j !== i));
                              edited();
                            }}
                          >
                            Remove axis {i + 1}
                          </button>
                        </fieldset>
                      ))}
                      <button
                        type="button"
                        className="button"
                        disabled={axes.length >= 3}
                        onClick={() => {
                          const axis =
                            (["A", "B", "C"] as const).find(
                              (a) => !axes.some((x) => x.axis === a),
                            ) ?? "A";
                          setAxes([
                            ...axes,
                            {
                              axis,
                              minimum_angle: "",
                              maximum_angle: "",
                              continuous: false,
                            },
                          ]);
                          edited();
                        }}
                      >
                        Add rotary axis
                      </button>
                    </div>
                  ) : d.value_type === "choice" ? (
                    <select
                      id="fact-value"
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        edited();
                      }}
                    >
                      <option value="">Select a value</option>
                      {d.choices?.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  ) : ["number", "integer"].includes(d.value_type) ? (
                    <input
                      id="fact-value"
                      type="number"
                      step={d.value_type === "integer" ? "1" : "any"}
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        edited();
                      }}
                    />
                  ) : (
                    <textarea
                      id="fact-value"
                      rows={d.value_type === "list" ? 4 : 3}
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        edited();
                      }}
                    />
                  )}
                </div>
                {d.allowed_units.length > 0 && (
                  <div className="form-field profile-unit-field">
                    <label htmlFor="fact-unit">Unit</label>
                    <select
                      id="fact-unit"
                      value={unit}
                      onChange={(e) => {
                        setUnit(e.target.value);
                        edited();
                      }}
                    >
                      {d.allowed_units.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                )}
              </fieldset>
              <div className="form-field profile-status-field">
                <label htmlFor="fact-status">Status</label>
                <select
                  id="fact-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FactStatus)}
                >
                  {Object.entries(factStatuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <p className="helper">
                  New or changed information needs review. Choose Confirmed only
                  after reviewing it. Missing and Not Applicable clear the saved
                  value.
                </p>
              </div>
            </section>
            <section
              className="profile-form-section"
              aria-labelledby="profile-source-heading"
            >
              <h3 id="profile-source-heading">Source / Basis</h3>
              <div className="form-field profile-document-field">
                <p className="helper">
                  Source / Basis:{" "}
                  {documentId ? "Document reference" : "Programmer entry"}
                </p>
                <label htmlFor="fact-document">
                  Supporting Document (optional)
                </label>
                <select
                  id="fact-document"
                  value={documentId}
                  disabled={documentLoading || !!documentError}
                  onChange={(e) => {
                    setDocumentId(e.target.value);
                    edited();
                  }}
                >
                  <option value="">None — Programmer entry</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title}
                      {doc.status === "ARCHIVED" ? " (Archived)" : ""}
                    </option>
                  ))}
                </select>
                <p className="helper">
                  Select an uploaded document only when it supports this
                  information.
                </p>
                {documentLoading && (
                  <p role="status">Loading source documents…</p>
                )}
                {documentError && (
                  <div>
                    <p role="alert">{documentError}</p>
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        setDocumentError("");
                        setDocumentLoading(true);
                        setDocumentAttempt((a) => a + 1);
                      }}
                    >
                      Retry source documents
                    </button>
                  </div>
                )}
              </div>
              <div className="form-field profile-location-field">
                <label htmlFor="fact-location">Source location / Page</label>
                <input
                  id="fact-location"
                  value={location}
                  maxLength={2000}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    edited();
                  }}
                />
              </div>
            </section>
            <section
              className="profile-form-section"
              aria-labelledby="profile-notes-heading"
            >
              <h3 id="profile-notes-heading">Engineering Notes</h3>
              <div className="form-field">
                <label htmlFor="fact-notes">Engineering notes</label>
                <textarea
                  id="fact-notes"
                  value={notes}
                  maxLength={20000}
                  rows={4}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    edited();
                  }}
                />
              </div>
            </section>
            {d.future_use && (
              <section
                className="profile-form-section profile-future"
                aria-labelledby="profile-future-heading"
              >
                <h3 id="profile-future-heading">Future Use</h3>
                <p>{d.future_use}</p>
              </section>
            )}
            {fact.created_at && (
              <p className="helper">
                Created {new Date(fact.created_at).toLocaleString()} · Updated{" "}
                {new Date(fact.updated_at!).toLocaleString()}
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button type="button" className="button" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="button primary"
                disabled={documentLoading || !!documentError}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
