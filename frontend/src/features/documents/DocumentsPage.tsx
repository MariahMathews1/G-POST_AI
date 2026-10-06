import PageHeader from "../../components/shared/PageHeader";
import EmptyState from "../../components/shared/EmptyState";
export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Manage machine and controller reference documents."
        action={
          <button className="button primary" disabled>
            Upload Document
          </button>
        }
      />
      <div className="filters">
        <label>
          Machine
          <select defaultValue="all">
            <option value="all">All machines</option>
            <option value="demo">KLS-1840N (demo)</option>
          </select>
        </label>
        <label>
          Document type
          <select defaultValue="all">
            <option value="all">All document types</option>
            {[
              "Machine Manual",
              "Controller Manual",
              "Programming Manual",
              "Specification Sheet",
              "G-POST/OFG Reference",
              "Approved Internal Reference",
            ].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
      </div>
      <section className="panel">
        <EmptyState
          title="No documents have been uploaded."
          description="Document upload will be available in a later sprint."
        />
      </section>
    </>
  );
}
