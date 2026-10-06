import { Link } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import EmptyState from "../../components/shared/EmptyState";
export default function PostBuilderPage() {
  return (
    <>
      <PageHeader
        title="Post Builder"
        description="Manage machine-specific Post development records."
        action={
          <button className="button primary" disabled>
            + Create Post
          </button>
        }
      />
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Post",
                "Machine",
                "Controller",
                "Status",
                "OFG Progress",
                "Updated",
                "Action",
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7}>
                <EmptyState
                  title="No Post Records have been created."
                  description="Post creation will be available in a later sprint."
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="demo-link">
        <Link to="/posts/demo">View demo Post workspace →</Link>
      </p>
    </>
  );
}
