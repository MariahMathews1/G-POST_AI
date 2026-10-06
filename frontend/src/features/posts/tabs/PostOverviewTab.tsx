import { Link } from "react-router";
import StatCard from "../../../components/shared/StatCard";
export default function PostOverviewTab() {
  return (
    <>
      <div className="stats-grid">
        <StatCard
          label="Machine Profile"
          value="0 confirmed"
          detail="0 missing"
        />
        <StatCard
          label="OFG Configuration"
          value="0 reviewed"
          detail="0 remaining"
        />
        <StatCard label="Custom Logic" value="0 requirements" />
        <StatCard label="Open Items" value="0" />
      </div>
      <section className="next-action">
        <div>
          <span className="eyebrow">Next Action</span>
          <h2>Start by reviewing the Machine Profile.</h2>
        </div>
        <Link className="button" to="/machines/demo">
          Open Machine
        </Link>
      </section>
    </>
  );
}
