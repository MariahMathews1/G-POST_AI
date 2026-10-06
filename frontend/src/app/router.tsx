import { Navigate, Route, Routes, Link } from "react-router";
import AppShell from "../components/layout/AppShell";
import DashboardPage from "../features/dashboard/DashboardPage";
import MachinesPage from "../features/machines/MachinesPage";
import AddMachinePage from "../features/machines/AddMachinePage";
import MachinePage from "../features/machines/MachinePage";
import EditMachinePage from "../features/machines/EditMachinePage";
import DocumentsPage from "../features/documents/DocumentsPage";
import PostBuilderPage from "../features/posts/PostBuilderPage";
import PostPage from "../features/posts/PostPage";
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="machines" element={<MachinesPage />} />
        <Route path="machines/new" element={<AddMachinePage />} />
        <Route path="machines/:machineId" element={<MachinePage />} />
        <Route path="machines/:machineId/edit" element={<EditMachinePage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="posts" element={<PostBuilderPage />} />
        <Route path="posts/:postId" element={<PostPage />} />
        <Route
          path="*"
          element={
            <>
              <h1>Page not found</h1>
              <Link to="/dashboard">Return to Dashboard</Link>
            </>
          }
        />
      </Route>
    </Routes>
  );
}
