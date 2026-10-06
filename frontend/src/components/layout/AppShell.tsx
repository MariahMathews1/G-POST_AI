import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
export default function AppShell() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="app-shell">
        <Sidebar />
        <div className="workspace">
          <TopBar />
          <main id="main-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
