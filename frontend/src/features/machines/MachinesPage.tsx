import { Link } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import EmptyState from "../../components/shared/EmptyState";
export default function MachinesPage() {
  return (
    <>
      <PageHeader
        title="Machines"
        description="Manage CNC machines used for Post development."
        action={
          <Link className="button primary" to="/machines/new">
            + Add Machine
          </Link>
        }
      />
      <div className="panel table-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Machine",
                "Manufacturer",
                "Model",
                "Type",
                "Controller",
                "Posts",
                "Status",
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
              <td colSpan={8}>
                <EmptyState
                  title="No machines have been added yet."
                  description="Add your first CNC machine to begin building a Machine Profile."
                  action={
                    <Link className="button" to="/machines/new">
                      Add Machine
                    </Link>
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="demo-link">
        <Link to="/machines/demo">View demo machine workspace →</Link>
      </p>
    </>
  );
}
