export default function MachineProfileTab() {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>Machine Profile</h2>
          <p>
            Reviewed machine and controller facts used as inputs for Post
            development.
          </p>
        </div>
      </div>
      <div className="actions">
        <button className="button primary" disabled>
          Add Fact Manually
        </button>
        <button className="button" disabled>
          Extract Machine Facts
        </button>
      </div>
      <p className="helper">
        Fact entry and extraction will be available in later sprints.
      </p>
      <div className="profile-sections">
        {[
          ["Needs Review", "No proposed facts are waiting for review."],
          ["Confirmed Facts", "No machine facts have been confirmed yet."],
          [
            "Missing Required Information",
            "Required Machine Profile fields will appear here later.",
          ],
        ].map(([title, message]) => (
          <section className="panel padded" key={title}>
            <h3>{title}</h3>
            <p>{message}</p>
          </section>
        ))}
      </div>
    </>
  );
}
