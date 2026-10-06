import { Link } from "react-router";
import EmptyState from "../../../components/shared/EmptyState";
import DocumentList from "../../documents/DocumentList";
export default function MachineDocumentsTab({
  machineId,
}: {
  machineId: string;
}) {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>Documents</h2>
          <p>Reference documents associated with this machine.</p>
        </div>
        {machineId === "demo" ? (
          <button className="button primary" disabled>
            Upload Document
          </button>
        ) : (
          <Link
            className="button primary"
            to={`/documents/upload?machine_id=${encodeURIComponent(machineId)}`}
          >
            Upload Document
          </Link>
        )}
      </div>
      {machineId === "demo" ? (
        <section className="panel">
          <EmptyState
            title="This static demo machine is not saved."
            description="Add a Machine to upload and associate reference documents."
          />
        </section>
      ) : (
        <DocumentList key={machineId} machineId={machineId} />
      )}
    </>
  );
}
