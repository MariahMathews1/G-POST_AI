import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import { documentsApi } from "../../api/documents";
import { machinesApi } from "../../api/machines";
import type { Machine } from "../../types/machine";
import type { UploadOptions } from "../../types/document";
import DocumentMetadataForm from "./DocumentMetadataForm";
import { fileSize } from "./format";
export default function UploadDocumentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [machineId, setMachineId] = useState(params.get("machine_id") ?? "");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [options, setOptions] = useState<UploadOptions | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      machinesApi.list(undefined, controller.signal),
      documentsApi.uploadOptions(controller.signal),
    ])
      .then(([machines, options]) => {
        if (!controller.signal.aborted) {
          setMachines(machines);
          setOptions(options);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Upload form could not be loaded. Try again.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [attempt]);
  const cancelTo =
    params.get("machine_id") &&
    machines.some((machine) => machine.id === params.get("machine_id"))
      ? `/machines/${params.get("machine_id")}`
      : "/documents";
  return (
    <>
      <PageHeader
        title="Upload Document"
        description="Attach an original machine or controller reference to a saved Machine."
      />
      {loading ? (
        <p role="status">Loading upload form…</p>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <button
            className="button retry-button"
            onClick={() => {
              setError("");
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
        </>
      ) : !machines.length ? (
        <section className="panel padded">
          <p>Add a Machine before uploading a reference document.</p>
          <Link className="button retry-button" to="/machines/new">
            + Add Machine
          </Link>
        </section>
      ) : (
        options && (
          <>
            <p className="notice">
              Accepted formats:{" "}
              {options.allowed_extensions
                .map((extension) => extension.slice(1).toUpperCase())
                .join(", ")}
              . Maximum file size: {fileSize(options.max_file_size)}.
            </p>
            <DocumentMetadataForm
              cancelTo={cancelTo}
              submitLabel="Upload Document"
              fileField={
                <div className="form-field full-width">
                  <label htmlFor="document-file">File</label>
                  <input
                    id="document-file"
                    name="file"
                    type="file"
                    accept={options.allowed_extensions.join(",")}
                    onChange={(event) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                    required
                  />
                </div>
              }
              validate={() => {
                const errors: Record<string, string> = {};
                if (!machines.some((machine) => machine.id === machineId))
                  errors.machine_id = "Select a saved Machine.";
                if (!file) errors.file = "Choose a reference document.";
                else {
                  const extension = file.name.includes(".")
                    ? `.${file.name.split(".").at(-1)?.toLowerCase()}`
                    : "";
                  if (!options.allowed_extensions.includes(extension))
                    errors.file =
                      "Unsupported file. Choose a PDF, TXT, or MD reference document.";
                  else if (!file.size)
                    errors.file =
                      "The file is empty. Choose a non-empty reference document.";
                  else if (file.size > options.max_file_size)
                    errors.file = `File exceeds the ${fileSize(options.max_file_size)} upload limit.`;
                }
                return errors;
              }}
              onSave={async (metadata) => {
                const document = await documentsApi.upload({
                  ...metadata,
                  machine_id: machineId,
                  file: file!,
                });
                navigate(`/documents/${document.id}`);
              }}
            >
              <div className="form-field full-width">
                <label htmlFor="upload-machine">Machine</label>
                <select
                  id="upload-machine"
                  name="machine_id"
                  value={machineId}
                  onChange={(event) => setMachineId(event.target.value)}
                  required
                >
                  <option value="">Select Machine</option>
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name}
                      {machine.status === "ARCHIVED" ? " (Archived)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </DocumentMetadataForm>
          </>
        )
      )}
    </>
  );
}
