import { Link, useNavigate } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
export default function AddMachinePage() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Add Machine"
        description="Define the machine and controller context for Post development."
      />
      <form
        className="panel machine-form"
        onSubmit={(event) => {
          event.preventDefault();
          navigate("/machines");
        }}
      >
        <p className="notice">
          Form preview only. Entries are not saved in this sprint.
        </p>
        <div className="form-grid">
          {["Machine Name", "Manufacturer", "Model"].map((label) => (
            <label key={label}>
              {label}
              <input
                name={label.toLowerCase().replaceAll(" ", "-")}
                autoComplete="off"
              />
            </label>
          ))}
          <label>
            Machine Type
            <select name="machine-type" defaultValue="">
              <option value="">Select type</option>
              <option>Lathe</option>
              <option>Mill</option>
              <option>Mill-Turn</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            Controller
            <input name="controller" autoComplete="off" />
          </label>
          <label>
            Status
            <select name="status" defaultValue="Active">
              <option>Active</option>
              <option>Archived</option>
            </select>
          </label>
          <label className="full-width">
            Notes
            <textarea name="notes" rows={4} />
          </label>
        </div>
        <div className="form-actions">
          <Link className="button" to="/machines">
            Cancel
          </Link>
          <button className="button primary" type="submit">
            Create Machine
          </button>
        </div>
      </form>
    </>
  );
}
