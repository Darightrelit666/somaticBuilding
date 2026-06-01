export type JointStatus = "OPTIMAL" | "CAUTIONARY" | "CRITICAL";

export interface JointData {
  id: string;
  name: string;
  mobility: number;
  stability: number;
  motorControl: number;
  status: JointStatus;
  description: string;
  position: { top: string; left: string };
}

export interface Dysfunction {
  id: string;
  jointId: string;
  name: string;
  severity: "CRITICAL" | "WARNING";
  delta: string;
  note: string;
}
