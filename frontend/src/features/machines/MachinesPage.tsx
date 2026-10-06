import { useEffect, useState } from "react";
import { Link } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import EmptyState from "../../components/shared/EmptyState";
import { machinesApi } from "../../api/machines";
import type { Machine, MachineStatus } from "../../types/machine";

type Filter = MachineStatus | "ALL";
export default function MachinesPage() {
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    machinesApi
      .list(filter === "ALL" ? undefined : filter, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setMachines(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Machines could not be loaded. Try again.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [filter, attempt]);
  function changeFilter(value: Filter) {
    setFilter(value);
    setLoading(true);
    setError("");
  }
  function retry() {
    setLoading(true);
    setError("");
    setAttempt((value) => value + 1);
  }
  return (
    <>
      <PageHeader
        title="Machines"
        description="Manage CNC machines used for Post development."
        action={
          <Link className="button primary" to="/machines/new">
            + Add Machine
          </Link>
        }
      />
      <div
        className="actions machine-filters"
        role="group"
        aria-label="Machine status filter"
      >
        {(
          [
            ["ACTIVE", "Active"],
            ["ARCHIVED", "Archived"],
            ["ALL", "All"],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            className={`button${filter === value ? " selected" : ""}`}
            key={value}
            aria-pressed={filter === value}
            onClick={() => {
              if (value !== filter) changeFilter(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <p role="status">Loading machines…</p>
      ) : error ? (
        <div className="panel padded">
          <p role="alert">{error}</p>
          <button type="button" className="button retry-button" onClick={retry}>
            Try again
          </button>
        </div>
      ) : (
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Machine",
                  "Manufacturer",
                  "Model",
                  "Type",
                  "Controller",
                  "Status",
                  "Action",
                ].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {machines.length ? (
                machines.map((machine) => (
                  <tr key={machine.id}>
                    <td>{machine.name}</td>
                    <td>{machine.manufacturer}</td>
                    <td>{machine.model}</td>
                    <td>{machine.machine_type}</td>
                    <td>{machine.controller}</td>
                    <td>
                      <span className="badge">
                        {machine.status === "ACTIVE" ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/machines/${machine.id}`}
                        aria-label={`Open ${machine.name}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title={
                        filter === "ARCHIVED"
                          ? "No archived machines."
                          : "No machines have been added yet."
                      }
                      description={
                        filter === "ARCHIVED"
                          ? "Archived machines remain available here for review or restoration."
                          : "Add your first CNC machine to begin organizing Post development."
                      }
                      action={
                        filter !== "ARCHIVED" && (
                          <Link className="button" to="/machines/new">
                            + Add Machine
                          </Link>
                        )
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
