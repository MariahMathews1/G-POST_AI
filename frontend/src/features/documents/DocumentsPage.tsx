import { Link } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import DocumentList from "./DocumentList";
export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Manage machine and controller reference documents."
        action={
          <Link className="button primary" to="/documents/upload">
            Upload Document
          </Link>
        }
      />
      <DocumentList />
    </>
  );
}
