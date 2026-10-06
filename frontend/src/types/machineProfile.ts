export type FactStatus =
  "MISSING" | "NEEDS_REVIEW" | "CONFIRMED" | "NOT_APPLICABLE";
export const factStatuses: Record<FactStatus, string> = {
  MISSING: "Missing",
  NEEDS_REVIEW: "Needs Review",
  CONFIRMED: "Confirmed",
  NOT_APPLICABLE: "Not Applicable",
};
export interface FactDefinition {
  key: string;
  display_name: string;
  description: string;
  category: string;
  value_type: "text" | "number" | "integer" | "choice" | "list" | "rotary_axes";
  allowed_units: string[];
  applicable_machine_types: string[];
  normally_important: boolean;
  display_order: number;
  machine_field?: string;
  choices?: string[];
  future_use?: string;
  extraction?: { eligible: boolean };
}
export interface RotaryAxis {
  axis: "A" | "B" | "C";
  minimum_angle: number;
  maximum_angle: number;
  continuous: boolean;
}
export type FactValue = string | number | string[] | RotaryAxis[] | null;
export interface ProfileFact {
  definition: FactDefinition;
  applicable: boolean;
  value: FactValue;
  unit: string | null;
  status: FactStatus | null;
  source_type: "MACHINE_RECORD" | "PROGRAMMER_ENTRY" | "DOCUMENT_REFERENCE";
  source_document_id: string | null;
  source_location: string;
  engineering_notes: string;
  created_at: string | null;
  updated_at: string | null;
}
export interface MachineProfile {
  machine_id: string;
  categories: { key: string; display_name: string; display_order: number }[];
  facts: ProfileFact[];
  summary: { confirmed: number; needs_review: number; missing: number };
}
export interface FactInput {
  value: FactValue;
  unit: string | null;
  status: FactStatus;
  source_document_id: string | null;
  source_location: string;
  engineering_notes: string;
}
