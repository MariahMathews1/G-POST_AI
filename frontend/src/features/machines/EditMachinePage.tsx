import { Link, useNavigate, useParams } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import MachineForm from "./MachineForm";
import { useMachine } from "./useMachine";
import { machinesApi } from "../../api/machines";
function EditMachine({ id }: { id: string }) {
  const { machine, loading, error, retry } = useMachine(id);
  const navigate = useNavigate();
  if (id === "demo")
    return (
      <>
        <h1>Demo machine</h1>
        <p>The static UI example cannot be edited.</p>
        <Link to="/machines/new">Add a real machine</Link>
      </>
    );
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
      <PageHeader
        title="Edit Machine"
        description={`Update basic information for ${machine.name}.`}
      />
      <MachineForm
        initialValues={machine}
        cancelTo={`/machines/${id}`}
        submitLabel="Save Changes"
        onSave={async (input) => {
          await machinesApi.update(id, input);
          navigate(`/machines/${id}`);
        }}
      />
    </>
  );
}
export default function EditMachinePage() {
  const { machineId = "" } = useParams();
  return <EditMachine key={machineId} id={machineId} />;
}
