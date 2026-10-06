import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router";
import { ApiError } from "../../api/client";
import { documentTypes } from "../../types/document";
import type { DocumentMetadataInput, DocumentType } from "../../types/document";

// One small form for shared metadata. Upload supplies only its Machine/File fields.
export default function DocumentMetadataForm({
  initialValues,
  cancelTo,
  submitLabel,
  children,
  fileField,
  onSave,
  validate,
}: {
  initialValues?: DocumentMetadataInput;
  cancelTo: string;
  submitLabel: string;
  children?: ReactNode;
  fileField?: ReactNode;
  onSave: (input: DocumentMetadataInput) => Promise<void>;
  validate?: () => Record<string, string>;
}) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [type, setType] = useState<DocumentType | "">(
    initialValues?.document_type ?? "",
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [focusField, setFocusField] = useState("");
  useEffect(() => {
    if (!saving && focusField)
      (
        formRef.current?.elements.namedItem(focusField) as HTMLElement | null
      )?.focus();
  }, [saving, focusField]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const validation = validate?.() ?? {};
    if (!title.trim()) validation.title = "Document Title is required.";
    if (!type) validation.document_type = "Document Type is required.";
    setErrors(validation);
    setError("");
    setFocusField("");
    if (Object.keys(validation).length) {
      (
        formRef.current?.elements.namedItem(
          Object.keys(validation)[0],
        ) as HTMLElement | null
      )?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        document_type: type as DocumentType,
        description: description.trim(),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields);
        setError(error.message);
        setFocusField(Object.keys(error.fields)[0] ?? "");
      } else setError("Document could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form
      className="panel machine-form"
      ref={formRef}
      onSubmit={submit}
      noValidate
    >
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={saving}>
        <div className="form-grid">
          {children}
          <div className="form-field">
            <label htmlFor="document-title">Document Title</label>
            <input
              id="document-title"
              name="title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setErrors((previous) => ({ ...previous, title: "" }));
              }}
              required
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "title-error" : undefined}
            />
            {errors.title && (
              <span id="title-error" className="field-error">
                {errors.title}
              </span>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="document-type">Document Type</label>
            <select
              id="document-type"
              name="document_type"
              value={type}
              onChange={(event) => {
                setType(event.target.value as DocumentType);
                setErrors((previous) => ({ ...previous, document_type: "" }));
              }}
              required
              aria-invalid={!!errors.document_type}
              aria-describedby={
                errors.document_type ? "document_type-error" : undefined
              }
            >
              <option value="">Select type</option>
              {Object.entries(documentTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.document_type && (
              <span className="field-error" id="document_type-error">
                {errors.document_type}
              </span>
            )}
          </div>
          {fileField}
          <div className="form-field full-width">
            <label htmlFor="document-description">
              Description / Notes <span className="optional">(optional)</span>
            </label>
            <textarea
              id="document-description"
              name="description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        {Object.entries(errors)
          .filter(
            ([key, message]) =>
              !["title", "document_type"].includes(key) && message,
          )
          .map(([key, message]) => (
            <p className="field-error" key={key} role="alert">
              {message}
            </p>
          ))}
      </fieldset>
      <div className="form-actions">
        <Link
          className="button"
          to={cancelTo}
          aria-disabled={saving}
          tabIndex={saving ? -1 : undefined}
          onClick={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          Cancel
        </Link>
        <button className="button primary" disabled={saving} type="submit">
          {saving
            ? submitLabel === "Upload Document"
              ? "Uploading…"
              : "Saving…"
            : submitLabel}
        </button>
      </div>
    </form>
  );
}
