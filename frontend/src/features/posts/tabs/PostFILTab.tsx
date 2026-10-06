import EmptyState from "../../../components/shared/EmptyState";
export default function PostFILTab() {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>FIL / Custom Logic</h2>
          <p>
            Track machine-level behaviors that may require logic beyond standard
            OFG configuration.
          </p>
        </div>
        <button className="button primary" disabled>
          + Add Custom Logic Requirement
        </button>
      </div>
      <section className="panel">
        <EmptyState title="No Custom Logic Requirements have been identified." />
      </section>
      <section className="panel section-block">
        <div className="panel-heading">
          <h2>FIL Drafts</h2>
        </div>
        <EmptyState
          title="No FIL/CIMFIL drafts exist."
          description="Requirement entry and drafts will be available in later sprints."
        />
      </section>
    </>
  );
}
