import { Link, useParams } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import Tabs from "../../components/shared/Tabs";
import MachineOverviewTab from "./tabs/MachineOverviewTab";
import MachineDocumentsTab from "./tabs/MachineDocumentsTab";
import MachineProfileTab from "./tabs/MachineProfileTab";
import MachineShopKnowledgeTab from "./tabs/MachineShopKnowledgeTab";
import MachinePostsTab from "./tabs/MachinePostsTab";
import { useMachine } from "./useMachine";
function MachineWorkspace({ id }: { id: string }) {
  const { machine, setMachine, loading, error, retry } = useMachine(id);
  if (loading) return <p role="status">Loading machine…</p>;
  if (error)
    return (
      <>
        <h1>
          {error.status === 404 ? "Machine not found" : "Machine unavailable"}
        </h1>
        <p role="alert">{error.message}</p>
        <Link to="/machines">Back to Machines</Link>
        {error.status !== 404 && (
          <button className="button retry-button" onClick={retry}>
            Try again
          </button>
        )}
      </>
    );
  if (!machine) return null;
  return (
    <>
      <Link className="back-link" to="/machines">
        ← Machines
      </Link>
      <PageHeader
        title={machine.name}
        description={`${machine.manufacturer} · ${machine.machine_type} · ${machine.controller}`}
        action={
          <span className="badge">
            {id === "demo"
              ? "Demo machine · Not saved"
              : machine.status === "ACTIVE"
                ? "Active"
                : "Archived"}
          </span>
        }
      />
      <Tabs
        label="Machine workspace"
        tabs={[
          {
            label: "Overview",
            content: (
              <MachineOverviewTab machine={machine} onChange={setMachine} />
            ),
          },
          {
            label: "Documents",
            content: <MachineDocumentsTab machineId={id} />,
          },
          {
            label: "Machine Profile",
            content: (
              <MachineProfileTab key={machine.updated_at} machineId={id} />
            ),
          },
          { label: "Shop Knowledge", content: <MachineShopKnowledgeTab /> },
          { label: "Posts", content: <MachinePostsTab /> },
        ]}
      />
    </>
  );
}
export default function MachinePage() {
  const { machineId = "" } = useParams();
  return <MachineWorkspace key={machineId} id={machineId} />;
}
