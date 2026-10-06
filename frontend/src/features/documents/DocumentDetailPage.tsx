import { useState } from "react";
import { Link, useParams } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import { documentsApi } from "../../api/documents";
import { documentTypes } from "../../types/document";
import { useDocument } from "./useDocument";
import { fileSize } from "./format";
import DocumentTextSection from "./DocumentTextSection";
function DocumentDetail({ id }: { id: string }) {
  const { document, setDocument, loading, error, retry } = useDocument(id);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  if (loading) return <p role="status">Loading document…</p>;
  if (error)
    return (
      <>
        <h1>
          {error.status === 404 ? "Document not found" : "Document unavailable"}
        </h1>
        <p role="alert">{error.message}</p>
        <Link to="/documents">Back to Documents</Link>
        {error.status !== 404 && (
          <button className="button retry-button" onClick={retry}>
            Try again
          </button>
        )}
      </>
    );
  if (!document) return null;
  async function changeStatus() {
    if (!document) return;
    if (
      document.status === "ACTIVE" &&
      !window.confirm(
        `Archive ${document.title}? Its original file and metadata will be retained.`,
      )
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      setDocument(
        await (document.status === "ACTIVE"
          ? documentsApi.archive(id)
          : documentsApi.restore(id)),
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Document status could not be updated. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/documents">
        ← Documents
      </Link>
      <PageHeader
        title={document.title}
        description="Original machine reference and document details."
        action={
          <span className="badge">
            {document.status === "ACTIVE" ? "Active" : "Archived"}
          </span>
        }
      />
      <section className="panel padded">
        <h2>Document Information</h2>
        <dl className="identity-grid">
          <div>
            <dt>Machine</dt>
            <dd>
              <Link to={`/machines/${document.machine_id}`}>
                {document.machine_name}
              </Link>
            </dd>
          </div>
          {[
            ["Title", document.title],
            ["Document Type", documentTypes[document.document_type]],
            ["Original Filename", document.original_filename],
            ["File Type", document.file_type],
            ["File Size", fileSize(document.file_size)],
            ["Status", document.status === "ACTIVE" ? "Active" : "Archived"],
            ["Uploaded Date", new Date(document.created_at).toLocaleString()],
            ["Last Updated", new Date(document.updated_at).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="machine-notes">
          <h3>Description</h3>
          <p>{document.description || "No description recorded."}</p>
        </div>
      </section>
      <div className="section-block">
        <div className="actions">
          <a
            className="button"
            href={documentsApi.fileUrl(id)}
            target="_blank"
            rel="noopener noreferrer"
          >
            View / Open File
          </a>
          <a
            className="button"
            href={documentsApi.fileUrl(id, true)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </a>
          <Link
            className="button primary"
            to={`/documents/${id}/edit`}
            aria-disabled={busy}
            tabIndex={busy ? -1 : undefined}
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            Edit Details
          </Link>
          <button className="button" disabled={busy} onClick={changeStatus}>
            {busy
              ? "Updating…"
              : document.status === "ACTIVE"
                ? "Archive"
                : "Restore"}
          </button>
        </div>
        {actionError && (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        )}
      </div>
      <DocumentTextSection id={id} fileType={document.file_type} />
    </>
  );
}
export default function DocumentDetailPage() {
  const { documentId = "" } = useParams();
  return <DocumentDetail key={documentId} id={documentId} />;
}
