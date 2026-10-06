import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ApiError } from "../../api/client";
import { machineTypes } from "../../types/machine";
import type { MachineCreateInput, MachineType } from "../../types/machine";

const requiredFields = [
  ["name", "Machine Name"],
  ["manufacturer", "Manufacturer"],
  ["model", "Model"],
  ["machine_type", "Machine Type"],
  ["controller", "Controller"],
] as const;
const emptyValues = {
  name: "",
  manufacturer: "",
  model: "",
  machine_type: "",
  controller: "",
  notes: "",
};

export default function MachineForm({
  initialValues,
  cancelTo,
  submitLabel,
  onSave,
}: {
  initialValues?: MachineCreateInput;
  cancelTo: string;
  submitLabel: string;
  onSave: (input: MachineCreateInput) => Promise<void>;
}) {
  const [values, setValues] = useState(() => {
    const source = initialValues ?? emptyValues;
    return {
      name: source.name,
      manufacturer: source.manufacturer,
      model: source.model,
      machine_type: source.machine_type,
      controller: source.controller,
      notes: source.notes,
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [focusField, setFocusField] = useState("");
  useEffect(() => {
    if (!saving && focusField) {
      (
        formRef.current?.elements.namedItem(focusField) as HTMLElement | null
      )?.focus();
    }
  }, [saving, focusField]);
  function change(field: string, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
  }
  return (
    <form
      ref={formRef}
      className="panel machine-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        const form = event.currentTarget;
        const trimmed = Object.fromEntries(
          Object.entries(values).map(([key, value]) => [key, value.trim()]),
        );
        const validation: Record<string, string> = {};
        for (const [key, label] of requiredFields)
          if (!trimmed[key]) validation[key] = `${label} is required.`;
        if (
          trimmed.machine_type &&
          !machineTypes.includes(trimmed.machine_type as MachineType)
        )
          validation.machine_type = "Select a valid Machine Type.";
        setErrors(validation);
        setSaveError("");
        setFocusField("");
        if (Object.keys(validation).length) {
          (
            form.elements.namedItem(Object.keys(validation)[0]) as HTMLElement
          )?.focus();
          return;
        }
        setSaving(true);
        try {
          await onSave(trimmed as unknown as MachineCreateInput);
        } catch (error) {
          if (error instanceof ApiError) {
            setErrors(error.fields);
            setSaveError(error.message);
            setFocusField(Object.keys(error.fields)[0] ?? "");
          } else setSaveError("Machine could not be saved. Try again.");
        } finally {
          setSaving(false);
        }
      }}
    >
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <fieldset disabled={saving}>
        <div className="form-grid">
          {requiredFields.map(([key, label]) => (
            <div className="form-field" key={key}>
              <label htmlFor={`machine-${key}`}>{label}</label>
              {key === "machine_type" ? (
                <select
                  id={`machine-${key}`}
                  name={key}
                  value={values[key]}
                  onChange={(event) => change(key, event.target.value)}
                  required
                  aria-invalid={!!errors[key]}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                >
                  <option value="">Select type</option>
                  {machineTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`machine-${key}`}
                  name={key}
                  value={values[key]}
                  onChange={(event) => change(key, event.target.value)}
                  autoComplete="off"
                  required
                  aria-invalid={!!errors[key]}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                />
              )}
              {errors[key] && (
                <span className="field-error" id={`${key}-error`}>
                  {errors[key]}
                </span>
              )}
            </div>
          ))}
          <div className="form-field full-width">
            <label htmlFor="machine-notes">
              Notes <span className="optional">(optional)</span>
            </label>
            <textarea
              id="machine-notes"
              name="notes"
              rows={4}
              value={values.notes}
              onChange={(event) => change("notes", event.target.value)}
            />
            {errors.notes && (
              <span className="field-error">{errors.notes}</span>
            )}
          </div>
        </div>
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
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
