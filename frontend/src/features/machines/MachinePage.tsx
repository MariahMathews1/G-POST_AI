import { Link, useParams } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import Tabs from "../../components/shared/Tabs";
import MachineOverviewTab from "./tabs/MachineOverviewTab";
import MachineDocumentsTab from "./tabs/MachineDocumentsTab";
import MachineProfileTab from "./tabs/MachineProfileTab";
import MachineShopKnowledgeTab from "./tabs/MachineShopKnowledgeTab";
import MachinePostsTab from "./tabs/MachinePostsTab";
export default function MachinePage() {
  const { machineId } = useParams();
  if (machineId !== "demo")
    return (
      <>
        <PageHeader
          title="Machine unavailable"
          description="Only the demo machine is available in this UI sprint."
        />
        <Link to="/machines/demo">Open demo machine</Link>
      </>
    );
  return (
    <>
      <Link className="back-link" to="/machines">
        ← Machines
      </Link>
      <PageHeader
        title="KLS-1840N"
        description="KENT · Lathe · FANUC 0i-TF"
        action={<span className="badge">Demo machine</span>}
      />
      <Tabs
        label="Machine workspace"
        tabs={[
          { label: "Overview", content: <MachineOverviewTab /> },
          { label: "Documents", content: <MachineDocumentsTab /> },
          { label: "Machine Profile", content: <MachineProfileTab /> },
          { label: "Shop Knowledge", content: <MachineShopKnowledgeTab /> },
          { label: "Posts", content: <MachinePostsTab /> },
        ]}
      />
    </>
  );
}
