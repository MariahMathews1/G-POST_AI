import { useState } from "react";
import { profileExtractionApi } from "../../api/profileExtraction";
import { machineProfilesApi } from "../../api/machineProfiles";
import { documentsApi } from "../../api/documents";
import {
  factStatuses,
  type FactValue,
  type MachineProfile,
} from "../../types/machineProfile";
import type {
  ExtractionRun,
  ProposedFactCandidate,
  CandidateReviewResponse,
} from "../../types/profileExtraction";

export function extractionValue(value: FactValue, unit: string | null) {
  return value === null
    ? "—"
    : `${Array.isArray(value) ? value.join(", ") : String(value)}${unit ? ` ${unit}` : ""}`;
}
// Values and units are already normalized by the backend. Keep their typed
// representation intact; display formatting must not merge different units.
function candidateGroups(candidates: ProposedFactCandidate[]) {
  const groups = new Map<string, ProposedFactCandidate[]>();
  for (const candidate of candidates.filter((c) => c.kind === "VALUE")) {
    const key = JSON.stringify([
      candidate.candidate_value,
      candidate.candidate_unit,
    ]);
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }
  return [...groups.entries()];
}
function sourceLabel(candidate: ProposedFactCandidate) {
  return `${candidate.document_title} · ${candidate.file_type === "PDF" ? "PDF page" : "Text section"} ${candidate.page_number}`;
}
function reviewStatus(candidate: ProposedFactCandidate) {
  return candidate.status === "APPLIED"
    ? "Applied"
    : candidate.status === "REJECTED"
      ? "Rejected"
      : "";
}
type Review = (
  candidate: ProposedFactCandidate,
  action: "apply" | "reject",
) => Promise<void>;
function SourceEvidence({
  candidate,
  busy,
  review,
  canReject,
}: {
  candidate: ProposedFactCandidate;
  busy: string;
  review: Review;
  canReject: boolean;
}) {
  return (
    <div className="extraction-source-evidence">
      <p className="extraction-source">
        <strong>{sourceLabel(candidate)}</strong>
        {reviewStatus(candidate) && ` · ${reviewStatus(candidate)}`}
      </p>
      <blockquote className="extraction-evidence">
        {candidate.evidence_text}
      </blockquote>
      <div className="actions">
        <a
          className="button"
          href={`${documentsApi.fileUrl(candidate.document_id)}${candidate.file_type === "PDF" ? `#page=${candidate.page_number}` : ""}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Source
        </a>
        {canReject && candidate.status === "PROPOSED" && (
          <button
            className="button"
            disabled={!!busy}
            onClick={() => review(candidate, "reject")}
          >
            {busy === candidate.id ? "Saving…" : "Reject Source"}
          </button>
        )}
      </div>
    </div>
  );
}
function CandidateGroup({
  candidates,
  busy,
  review,
}: {
  candidates: ProposedFactCandidate[];
  busy: string;
  review: Review;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const proposed = candidates.filter((c) => c.status === "PROPOSED");
  const selected =
    candidates.length === 1
      ? proposed[0]
      : proposed.find((c) => c.id === selectedId);
  const supporting = candidates.filter((c) => c.status !== "REJECTED").length;
  const rejected = candidates.length - supporting;
  const first = candidates[0];
  const value = extractionValue(first.candidate_value, first.candidate_unit);
  return (
    <article className="extraction-candidate" aria-label={`Candidate ${value}`}>
      <div className="extraction-candidate-heading">
        <h4 className="extraction-candidate-value">{value}</h4>
        <span className="helper">
          {supporting > 0 &&
            `${supporting} supporting source${supporting === 1 ? "" : "s"}`}
          {supporting > 0 && rejected > 0 && " · "}
          {rejected > 0 &&
            `${rejected} rejected source${rejected === 1 ? "" : "s"}`}
        </span>
      </div>
      <ul className="extraction-source-list">
        {candidates.map((candidate) => (
          <li key={candidate.id}>
            {sourceLabel(candidate)}
            {reviewStatus(candidate) && (
              <span className="extraction-review-status">
                {reviewStatus(candidate)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {candidates.length > 1 && proposed.length > 0 && (
        <label className="extraction-primary-source">
          <span>Primary source</span>
          <select
            value={selected?.id ?? ""}
            disabled={!!busy}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Choose a source before Apply or Reject</option>
            {proposed.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {sourceLabel(candidate)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="actions">
        <button
          className="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide Evidence" : "Show Evidence"}
        </button>
        {proposed.length > 0 && (
          <>
            <button
              className="button"
              disabled={!!busy || !selected}
              onClick={() => selected && review(selected, "reject")}
            >
              {selected && busy === selected.id ? "Saving…" : "Reject"}
            </button>
            <button
              className="button primary"
              disabled={!!busy || !selected}
              onClick={() => selected && review(selected, "apply")}
            >
              {selected && busy === selected.id ? "Saving…" : "Apply"}
            </button>
          </>
        )}
      </div>
      {proposed.length > 0 && (
        <p className="helper extraction-apply-note">
          Apply replaces the current value and sets Needs Review.
          {candidates.length > 1 &&
            " Only the selected source is applied or rejected; other source records remain unchanged."}
        </p>
      )}
      {expanded && (
        <div className="extraction-evidence-list">
          {candidates.map((candidate) => (
            <SourceEvidence
              key={candidate.id}
              candidate={candidate}
              busy={busy}
              review={review}
              canReject={candidates.length > 1}
            />
          ))}
        </div>
      )}
    </article>
  );
}
function RelatedEvidence({
  candidates,
  busy,
  review,
}: {
  candidates: ProposedFactCandidate[];
  busy: string;
  review: Review;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="extraction-related" aria-label="Related Evidence">
      <div className="extraction-related-heading">
        <h4>Related Evidence ({candidates.length})</h4>
        <button
          className="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
      {expanded &&
        candidates.map((candidate) => (
          <SourceEvidence
            key={candidate.id}
            candidate={candidate}
            busy={busy}
            review={review}
            canReject
          />
        ))}
    </section>
  );
}
export default function ExtractionResults({
  run,
  profile,
  onReviewed,
  onBack,
  onSearchAgain,
}: {
  run: ExtractionRun;
  profile: MachineProfile;
  onReviewed: (result: CandidateReviewResponse) => void;
  onBack: () => void;
  onSearchAgain: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function review(
    candidate: ProposedFactCandidate,
    action: "apply" | "reject",
  ) {
    setBusy(candidate.id);
    setError("");
    try {
      const current = profile.facts.find(
        (f) => f.definition.key === candidate.fact_key,
      );
      onReviewed(
        await (action === "apply"
          ? profileExtractionApi.apply(
              candidate.id,
              profile.machine_id,
              current?.updated_at ?? null,
            )
          : profileExtractionApi.reject(candidate.id, profile.machine_id)),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Candidate review could not be saved. Try again.",
      );
    } finally {
      setBusy("");
    }
  }
  async function refresh() {
    setBusy("refresh");
    setError("");
    try {
      const [p, r] = await Promise.all([
        machineProfilesApi.get(profile.machine_id),
        profileExtractionApi.candidates(profile.machine_id, run.id),
      ]);
      if (r) onReviewed({ profile: p, run: r });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Current values could not be refreshed.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="extraction-workspace">
      <button className="profile-back" disabled={!!busy} onClick={onBack}>
        ← Machine Profile
      </button>
      <h2>Find Information Results</h2>
      <p className="helper">
        Searched: {run.documents.map((d) => d.title).join(" · ")}
      </p>
      <p className="helper">
        Nothing is written until you Apply. Applied values need engineering
        review before confirmation.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions extraction-result-actions">
        <button className="button" disabled={!!busy} onClick={refresh}>
          Refresh Current Values
        </button>
        <button className="button" disabled={!!busy} onClick={onSearchAgain}>
          Search Again
        </button>
      </div>
      {run.results.map((group) => {
        const current = profile.facts.find(
          (f) => f.definition.key === group.fact_key,
        );
        const groups = candidateGroups(group.candidates);
        const related = group.candidates.filter(
          (c) => c.kind === "RELATED_EVIDENCE",
        );
        const label =
          groups.length > 1
            ? "Multiple Candidates"
            : groups.length === 1
              ? "1 Candidate"
              : related.length
                ? "Related Evidence Only"
                : group.state === "PROCESSING_ERROR"
                  ? "Processing Error"
                  : "No Information Found";
        return (
          <section
            className="panel padded extraction-result-group"
            key={group.fact_key}
            aria-label={group.display_name}
          >
            <div className="section-header">
              <h3>{group.display_name}</h3>
              <span className="helper">{label}</span>
            </div>
            <div className="extraction-current">
              <strong>Current Profile Value</strong>
              <p>
                {current
                  ? extractionValue(current.value, current.unit)
                  : "Not applicable to the current Machine type"}
                {current?.status && (
                  <span className="extraction-current-status">
                    {factStatuses[current.status]}
                  </span>
                )}
              </p>
            </div>
            {groups.length > 1 && (
              <p className="helper">
                Sources disagree. Review each value and its evidence before
                choosing.
              </p>
            )}
            {!groups.length && <p className="helper">{group.message}</p>}
            {group.warnings.map((w) => (
              <p className="notice" key={w}>
                {w}
              </p>
            ))}
            {groups.map(([key, candidates]) => (
              <CandidateGroup
                key={key}
                candidates={candidates}
                busy={busy}
                review={review}
              />
            ))}
            {related.length > 0 && (
              <RelatedEvidence
                candidates={related}
                busy={busy}
                review={review}
              />
            )}
          </section>
        );
      })}
    </section>
  );
}
