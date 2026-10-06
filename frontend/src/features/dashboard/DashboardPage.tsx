import { Link } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import StatCard from "../../components/shared/StatCard";
import EmptyState from "../../components/shared/EmptyState";
export default function DashboardPage() {
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
          <StatCard key={label} label={label} value="0" />
        ))}
      </div>
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
