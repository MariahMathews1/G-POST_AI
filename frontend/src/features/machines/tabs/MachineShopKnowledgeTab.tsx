import EmptyState from "../../../components/shared/EmptyState";
export default function MachineShopKnowledgeTab() {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>Shop Knowledge</h2>
          <p>
            Practical machine knowledge from programmers, operators, and
            shop-floor experience.
          </p>
        </div>
        <button className="button primary" disabled>
          + Add Shop Note
        </button>
      </div>
      <section className="panel">
        <EmptyState
          title="No shop knowledge has been recorded yet."
          description="Shop note entry will be available in a later sprint."
        />
      </section>
    </>
  );
}
