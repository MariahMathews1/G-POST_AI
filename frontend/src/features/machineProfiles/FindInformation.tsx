import { useEffect, useState } from "react";
import { Link } from "react-router";
import { profileExtractionApi } from "../../api/profileExtraction";
import { documentTypes } from "../../types/document";
import type { MachineProfile } from "../../types/machineProfile";
import type {
  ExtractionDocument,
  ExtractionRun,
} from "../../types/profileExtraction";
import ExtractionResults, { extractionValue } from "./ExtractionResults";
export default function FindInformation({
  profile,
  onProfileChanged,
  onBack,
}: {
  profile: MachineProfile;
  onProfileChanged: (p: MachineProfile) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<"facts" | "documents" | "results">("facts");
  const [factKeys, setFactKeys] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<ExtractionDocument[]>([]);
  const [run, setRun] = useState<ExtractionRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      profileExtractionApi.documents(profile.machine_id, controller.signal),
      profileExtractionApi.candidates(
        profile.machine_id,
        undefined,
        controller.signal,
      ),
    ])
      .then(([docs, latest]) => {
        if (!controller.signal.aborted) {
          setDocuments(docs);
          setDocumentIds((selected) =>
            selected.filter((id) => docs.some((doc) => doc.id === id)),
          );
          setRun(latest);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [profile.machine_id, attempt]);
  const facts = profile.facts.filter(
    (f) =>
      f.applicable &&
      !f.definition.machine_field &&
      f.definition.extraction?.eligible,
  );
  function toggle(
    value: string,
    selected: string[],
    setSelected: (values: string[]) => void,
  ) {
    setSelected(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }
  async function find() {
    setBusy(true);
    setError("");
    try {
      setRun(
        await profileExtractionApi.find(
          profile.machine_id,
          factKeys,
          documentIds,
        ),
      );
      setStep("results");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Information could not be found. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (step === "results" && run)
    return (
      <ExtractionResults
        run={run}
        profile={profile}
        onBack={onBack}
        onSearchAgain={() => setStep("facts")}
        onReviewed={(result) => {
          setRun(result.run);
          onProfileChanged(result.profile);
        }}
      />
    );
  return (
    <section className="extraction-workspace">
      <button className="profile-back" disabled={busy} onClick={onBack}>
        ← Machine Profile
      </button>
      <h2>{step === "facts" ? "Find Information" : "Select Documents"}</h2>
      <p>
        {step === "facts"
          ? "Select the profile information you want to find."
          : "Select prepared references associated with this Machine."}
      </p>
      {loading ? (
        <p role="status">Loading available references…</p>
      ) : (
        <>
          {error && (
            <div>
              <p className="form-error" role="alert">
                {error}
              </p>
              {step === "facts" && (
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setLoading(true);
                    setAttempt((a) => a + 1);
                  }}
                >
                  Refresh References
                </button>
              )}
            </div>
          )}
          <fieldset className="extraction-selection" disabled={busy}>
            {step === "facts" ? (
              <>
                {profile.categories.map((category) => {
                  const rows = facts.filter(
                    (f) => f.definition.category === category.key,
                  );
                  return (
                    rows.length > 0 && (
                      <fieldset
                        className="panel padded extraction-selection-group"
                        key={category.key}
                      >
                        <legend>{category.display_name}</legend>
                        {rows.map((f) => (
                          <label
                            className="extraction-option"
                            key={f.definition.key}
                          >
                            <input
                              type="checkbox"
                              checked={factKeys.includes(f.definition.key)}
                              onChange={() =>
                                toggle(f.definition.key, factKeys, setFactKeys)
                              }
                            />
                            <span>
                              <strong>{f.definition.display_name}</strong>
                              {f.value !== null && (
                                <span className="helper">
                                  Current: {extractionValue(f.value, f.unit)}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </fieldset>
                    )
                  );
                })}
                {!facts.length && (
                  <p>
                    No applicable information is supported by deterministic
                    search for this Machine.
                  </p>
                )}
                <p className="helper">{factKeys.length} selected</p>
                <div className="actions">
                  <button
                    className="button primary"
                    disabled={!factKeys.length || !!error}
                    onClick={() => setStep("documents")}
                  >
                    Continue
                  </button>
                  {run && (
                    <button
                      className="button"
                      onClick={() => setStep("results")}
                    >
                      Review Last Results
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="helper">
                  {factKeys.length} profile facts selected
                </p>
                {!documents.length ? (
                  <div className="notice">
                    <p>No prepared documents are available for this machine.</p>
                    <Link to="/documents">Open Documents</Link>
                    <p className="helper">
                      Prepare the references there, then refresh this list.
                    </p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <label
                      className="extraction-option panel padded"
                      key={doc.id}
                    >
                      <input
                        type="checkbox"
                        checked={documentIds.includes(doc.id)}
                        onChange={() =>
                          toggle(doc.id, documentIds, setDocumentIds)
                        }
                      />
                      <span>
                        <strong>{doc.title}</strong>
                        <span className="helper">
                          {documentTypes[doc.document_type]} ·{" "}
                          {doc.processing_state === "READY"
                            ? "Ready"
                            : "Partial"}
                        </span>
                      </span>
                    </label>
                  ))
                )}
                <div className="actions">
                  <button className="button" onClick={() => setStep("facts")}>
                    Back
                  </button>
                  <button
                    className="button primary"
                    disabled={!documentIds.length || !!error}
                    onClick={find}
                  >
                    {busy ? "Finding Information…" : "Find Information"}
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      setError("");
                      setLoading(true);
                      setAttempt((a) => a + 1);
                    }}
                  >
                    Refresh References
                  </button>
                </div>
                {busy && (
                  <p role="status">
                    Searching selected prepared pages locally…
                  </p>
                )}
              </>
            )}
          </fieldset>
        </>
      )}
    </section>
  );
}
