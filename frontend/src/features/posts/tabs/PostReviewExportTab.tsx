export default function PostReviewExportTab() {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>Review & Export</h2>
          <p>Review remaining work and prepare a Post Development Package.</p>
        </div>
      </div>
      <div className="panel review-list">
        {[
          "Machine Profile",
          "OFG Configuration",
          "Custom Logic",
          "FIL Drafts",
          "Open Items",
          "Post Development Package",
        ].map((label) => (
          <div key={label}>
            <span>{label}</span>
            <span className="muted">Not started</span>
          </div>
        ))}
      </div>
      <div className="section-block">
        <button className="button primary" disabled>
          Export Package
        </button>
        <p className="helper">Export will be implemented in a later sprint.</p>
      </div>
    </>
  );
}
