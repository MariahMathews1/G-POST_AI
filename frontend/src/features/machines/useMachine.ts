import { useEffect, useState } from "react";
import { machinesApi } from "../../api/machines";
import { ApiError } from "../../api/client";
import type { Machine } from "../../types/machine";

// Preserve the UI-shell inspection route without seeding the real database.
const demoMachine: Machine = {
  id: "demo",
  name: "KLS-1840N",
  manufacturer: "KENT",
  model: "KLS-1840N",
  machine_type: "Lathe",
  controller: "FANUC 0i-TF",
  status: "ACTIVE",
  notes: "Static UI example. This machine is not saved.",
  created_at: "",
  updated_at: "",
};

export function useMachine(id: string) {
  const [machine, setMachine] = useState<Machine | null>(
    id === "demo" ? demoMachine : null,
  );
  const [loading, setLoading] = useState(id !== "demo");
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (id === "demo") return;
    const controller = new AbortController();
    machinesApi
      .get(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setMachine(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof ApiError
              ? error
              : new ApiError("Machine could not be loaded. Try again."),
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, attempt]);
  function retry() {
    setError(null);
    setLoading(true);
    setAttempt((value) => value + 1);
  }
  return { machine, setMachine, loading, error, retry };
}
