import EmptyState from "../../../components/shared/EmptyState";
export default function MachineDocumentsTab() {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>Documents</h2>
          <p>Machine and controller references associated with this machine.</p>
        </div>
        <button className="button primary" disabled>
          Upload Document
        </button>
      </div>
      <section className="panel">
        <EmptyState
          title="No documents have been added for this machine."
          description="Document upload will be available in a later sprint."
        />
      </section>
    </>
  );
}
