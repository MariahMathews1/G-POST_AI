import { useEffect, useState } from "react";
import { machinesApi } from "../../api/machines";
import { Link } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import StatCard from "../../components/shared/StatCard";
import EmptyState from "../../components/shared/EmptyState";
export default function DashboardPage() {
  const [machineCount, setMachineCount] = useState<string>("…");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    machinesApi
      .list("ACTIVE", controller.signal)
      .then((machines) => {
        if (!controller.signal.aborted)
          setMachineCount(String(machines.length));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setMachineCount("—");
          setError(
            "Machine count is unavailable. Check that the backend is running.",
          );
        }
      });
    return () => controller.abort();
  }, []);
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your starting point for machine-specific Post development."
      />
      <div className="stats-grid">
        {[
          "Machines",
          "Posts in Development",
          "Needs Attention",
          "Documents",
        ].map((label) => (
          <StatCard
            key={label}
            label={label}
            value={label === "Machines" ? machineCount : "0"}
          />
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <section className="section-block">
        <h2>Quick Actions</h2>
        <div className="actions">
          <Link className="button primary" to="/machines/new">
            + Add Machine
          </Link>
          <Link className="button" to="/documents">
            Upload Document
          </Link>
          <Link className="button" to="/posts">
            Create Post
          </Link>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Recent Post Work</h2>
        </div>
        <EmptyState
          title="No Post work yet."
          description="Add a machine to begin organizing its Post development work."
        />
      </section>
    </>
  );
}
