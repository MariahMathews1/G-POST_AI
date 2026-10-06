import { Link } from "react-router";
import EmptyState from "../../../components/shared/EmptyState";
export default function MachinePostsTab() {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>Posts</h2>
          <p>Post development records associated with this machine.</p>
        </div>
        <button className="button primary" disabled>
          + Create Post
        </button>
      </div>
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Post Name",
                "Status",
                "OFG Progress",
                "Custom Logic",
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
              <td colSpan={6}>
                <EmptyState title="No Post Records exist for this machine." />
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
