import { Link } from "react-router";
export default function MachineOverviewTab() {
  return (
    <>
      <section className="panel padded">
        <h2>Machine Information</h2>
        <dl className="identity-grid">
          {[
            ["Manufacturer", "KENT"],
            ["Model", "KLS-1840N"],
            ["Machine Type", "Lathe"],
            ["Controller", "FANUC 0i-TF"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="summary-strip">
        <span>
          Documents: <strong>0</strong>
        </span>
        <span>
          Machine Profile: <strong>Not Started</strong>
        </span>
        <span>
          Posts: <strong>0</strong>
        </span>
      </div>
      <section className="next-action">
        <div>
          <span className="eyebrow">Next Action</span>
          <h2>Upload machine documentation</h2>
        </div>
        <Link className="button" to="/documents">
          View Documents
        </Link>
      </section>
    </>
  );
}
