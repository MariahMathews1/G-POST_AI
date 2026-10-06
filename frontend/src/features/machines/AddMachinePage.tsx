import { useNavigate } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import { machinesApi } from "../../api/machines";
import MachineForm from "./MachineForm";
export default function AddMachinePage() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Add Machine"
        description="Define the machine and controller context for Post development."
      />
      <MachineForm
        cancelTo="/machines"
        submitLabel="Create Machine"
        onSave={async (input) => {
          const machine = await machinesApi.create(input);
          navigate(`/machines/${machine.id}`);
        }}
      />
    </>
  );
}
