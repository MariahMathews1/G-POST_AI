import { NavLink } from "react-router";
import { navigation } from "../../app/navigation";
const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  machines: "M3 20h18 M5 20V9h14v11 M8 9V4h8v5 M9 13h6 M12 13v4",
  documents: "M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6",
  posts: "M5 3h14v18H5z M8 8h8 M8 12h8 M8 16h5",
};
export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          C
        </span>
        <div>
          <strong>Creo NC</strong>
          <span>G-POST Companion</span>
        </div>
      </div>
      <nav aria-label="Primary navigation">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <svg
              aria-hidden="true"
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              <path d={paths[item.icon]} />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">Post Development Assistant</div>
    </aside>
  );
}
