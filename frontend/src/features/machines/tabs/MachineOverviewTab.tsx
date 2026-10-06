import { useState } from "react";
import { Link } from "react-router";
import type { Machine } from "../../../types/machine";
import { machinesApi } from "../../../api/machines";
function date(value: string) {
  return value ? new Date(value).toLocaleString() : "—";
}
export default function MachineOverviewTab({
  machine,
  onChange,
}: {
  machine: Machine;
  onChange: (machine: Machine) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function changeStatus() {
    if (
      machine.status === "ACTIVE" &&
      !window.confirm(
        `Archive ${machine.name}? The record will be retained and can be restored.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      onChange(
        await (machine.status === "ACTIVE"
          ? machinesApi.archive(machine.id)
          : machinesApi.restore(machine.id)),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Machine status could not be updated. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel padded">
        <h2>Machine Information</h2>
        <dl className="identity-grid">
          {[
            ["Machine Name", machine.name],
            ["Manufacturer", machine.manufacturer],
            ["Model", machine.model],
            ["Machine Type", machine.machine_type],
            ["Controller", machine.controller],
            ["Status", machine.status === "ACTIVE" ? "Active" : "Archived"],
            ["Created date", date(machine.created_at)],
            ["Last updated date", date(machine.updated_at)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="machine-notes">
          <h3>Notes</h3>
          <p>{machine.notes || "No notes recorded."}</p>
        </div>
      </section>
      {machine.id !== "demo" && (
        <div className="section-block">
          <div className="actions">
            <Link
              className="button primary"
              to={`/machines/${machine.id}/edit`}
              aria-disabled={busy}
              tabIndex={busy ? -1 : undefined}
              onClick={(event) => {
                if (busy) event.preventDefault();
              }}
            >
              Edit Machine
            </Link>
            <button className="button" disabled={busy} onClick={changeStatus}>
              {busy
                ? "Updating…"
                : machine.status === "ACTIVE"
                  ? "Archive Machine"
                  : "Restore Machine"}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
