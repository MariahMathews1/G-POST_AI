export const machineTypes = [
  "Lathe",
  "Mill",
  "Mill-Turn",
  "Swiss",
  "Other",
] as const;
export type MachineType = (typeof machineTypes)[number];
export type MachineStatus = "ACTIVE" | "ARCHIVED";
export interface MachineCreateInput {
  name: string;
  manufacturer: string;
  model: string;
  machine_type: MachineType;
  controller: string;
  notes: string;
}
export type MachineUpdateInput = MachineCreateInput;
export interface Machine extends MachineCreateInput {
  id: string;
  status: MachineStatus;
  created_at: string;
  updated_at: string;
}
