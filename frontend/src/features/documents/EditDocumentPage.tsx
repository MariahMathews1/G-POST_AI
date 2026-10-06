import { Link, useNavigate, useParams } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import { documentsApi } from "../../api/documents";
import { useDocument } from "./useDocument";
import DocumentMetadataForm from "./DocumentMetadataForm";
function EditDocument({ id }: { id: string }) {
  const { document, loading, error, retry } = useDocument(id);
  const navigate = useNavigate();
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
  return (
    <>
      <PageHeader
        title="Edit Document Details"
        description="Update metadata. To use a different file, upload a new Document."
      />
      <DocumentMetadataForm
        initialValues={document}
        cancelTo={`/documents/${id}`}
        submitLabel="Save Changes"
        onSave={async (input) => {
          await documentsApi.update(id, input);
          navigate(`/documents/${id}`);
        }}
      />
    </>
  );
}
export default function EditDocumentPage() {
  const { documentId = "" } = useParams();
  return <EditDocument key={documentId} id={documentId} />;
}
