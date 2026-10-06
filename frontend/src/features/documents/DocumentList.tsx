import { useEffect, useState } from "react";
import { Link } from "react-router";
import EmptyState from "../../components/shared/EmptyState";
import { documentsApi } from "../../api/documents";
import { machinesApi } from "../../api/machines";
import { documentTypes } from "../../types/document";
import type {
  DocumentRecord,
  DocumentType,
  DocumentStatus,
} from "../../types/document";
import type { Machine } from "../../types/machine";
import { documentDate, fileSize } from "./format";

export default function DocumentList({ machineId }: { machineId?: string }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [type, setType] = useState<DocumentType | "">("");
  const [status, setStatus] = useState<DocumentStatus | "ALL">("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [machineError, setMachineError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const uploadTo = `/documents/upload${machineId ? `?machine_id=${encodeURIComponent(machineId)}` : ""}`;
  useEffect(() => {
    const controller = new AbortController();
    documentsApi
      .list(
        {
          machine_id: machineId || selectedMachine || undefined,
          document_type: type || undefined,
          status: status === "ALL" ? undefined : status,
        },
        controller.signal,
      )
      .then((result) => {
        if (!controller.signal.aborted) {
          setDocuments(result);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error
              ? error.message
              : "Documents could not be loaded. Try again.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [machineId, selectedMachine, type, status, attempt]);
  useEffect(() => {
    if (machineId) return;
    const controller = new AbortController();
    machinesApi
      .list(undefined, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setMachines(result);
          setMachineError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMachineError(
            "The Machine filter is unavailable. Check the backend and try again.",
          );
      });
    return () => controller.abort();
  }, [machineId, attempt]);
  function refresh() {
    setError("");
    setLoading(true);
    setAttempt((value) => value + 1);
  }
  const filtered = !!type || !!selectedMachine || status !== "ACTIVE";
  return (
    <>
      <div className="filters">
        {!machineId && (
          <label>
            Machine
            <select
              value={selectedMachine}
              onChange={(event) => {
                setSelectedMachine(event.target.value);
                setLoading(true);
                setError("");
              }}
            >
              <option value="">All machines</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                  {machine.status === "ARCHIVED" ? " (Archived)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Document Type
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as DocumentType | "");
              setLoading(true);
              setError("");
            }}
          >
            <option value="">All document types</option>
            {Object.entries(documentTypes).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as DocumentStatus | "ALL");
              setLoading(true);
              setError("");
            }}
          >
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="ALL">All</option>
          </select>
        </label>
      </div>
      {machineError && (
        <p role="alert">
          {machineError}{" "}
          <button className="button" onClick={refresh}>
            Try again
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Loading documents…</p>
      ) : error ? (
        <div className="panel padded">
          <p role="alert">{error}</p>
          <button className="button retry-button" onClick={refresh}>
            Try again
          </button>
        </div>
      ) : (
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                {(machineId
                  ? ["Document", "Type", "File", "Uploaded", "Status", "Action"]
                  : [
                      "Document",
                      "Machine",
                      "Type",
                      "File",
                      "Size",
                      "Uploaded",
                      "Status",
                      "Action",
                    ]
                ).map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.length ? (
                documents.map((document) => (
                  <tr key={document.id}>
                    <td>{document.title}</td>
                    {!machineId && (
                      <td>
                        <Link to={`/machines/${document.machine_id}`}>
                          {document.machine_name}
                        </Link>
                      </td>
                    )}
                    <td>{documentTypes[document.document_type]}</td>
                    <td>{document.original_filename}</td>
                    {!machineId && <td>{fileSize(document.file_size)}</td>}
                    <td>{documentDate(document.created_at)}</td>
                    <td>
                      <span className="badge">
                        {document.status === "ACTIVE" ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/documents/${document.id}`}
                        aria-label={`Open ${document.title}`}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={machineId ? 6 : 8}>
                    <EmptyState
                      title={
                        filtered
                          ? "No documents match these filters."
                          : "No documents have been uploaded yet."
                      }
                      description="Upload machine or controller references to begin building the engineering record for a machine."
                      action={
                        <Link className="button" to={uploadTo}>
                          Upload Document
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
