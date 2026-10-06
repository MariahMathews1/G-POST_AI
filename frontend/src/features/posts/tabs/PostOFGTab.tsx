const categories = [
  "Machine & Axes",
  "File Formats",
  "Program Start / End",
  "Motion",
  "Feedrates",
  "Tooling",
  "Spindle",
  "Coolant",
  "Cycles",
  "Machine Codes",
  "Operator Messages",
  "Advanced",
];
export default function PostOFGTab() {
  return (
    <>
      <div className="section-header">
        <div>
          <h2>OFG Configuration</h2>
          <p>
            Machine-specific checklist for configuring the Creo/G-POST Option
            File Generator.
          </p>
        </div>
      </div>
      <p className="notice">
        Exact OFG locations will be added only after verified against approved
        references.
      </p>
      <ul className="category-list">
        {categories.map((category) => (
          <li key={category}>
            <span>{category}</span>
            <span className="muted">0 reviewed</span>
          </li>
        ))}
      </ul>
    </>
  );
}
