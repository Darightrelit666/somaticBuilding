import { httpGet, httpPost } from "./http";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const readNumber = (source: UnknownRecord, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
};

const readString = (source: UnknownRecord, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
};

const readArray = (source: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const readId = (payload: unknown) => {
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (typeof payload === "string") {
    const parsed = Number(payload);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (isRecord(payload)) {
    return readNumber(payload, ["id", "sessionId", "session_id", "testId", "test_id"], 0);
  }
  return 0;
};

export type AssessmentTestData = {
  id: number;
  name: string;
  category: string;
  status: number;
};

export type JointMetricData = {
  joint: string;
  mobility: number;
  stability: number;
  motorControl: number;
  status: number;
};

export type RiskAlertData = {
  joint: string;
  severity: number;
  message: string;
};

export type AssessmentSummaryData = {
  summary: string;
  jointMetrics: JointMetricData[];
  riskAlerts: RiskAlertData[];
};

export const createAssessmentSession = async (userId: number) => {
  const data = await httpPost<unknown>("/api/v1/assessment/session", {
    userId,
    user_id: userId
  });
  const id = readId(data);
  if (!id) {
    throw new Error("Assessment session was created without an id.");
  }
  return { id };
};

export const saveAssessmentStep = async (payload: {
  sessionId: number;
  stepType: string;
  stepStatus: number;
}) => {
  const data = await httpPost<unknown>("/api/v1/assessment/step", {
    sessionId: payload.sessionId,
    session_id: payload.sessionId,
    stepType: payload.stepType,
    step_type: payload.stepType,
    stepStatus: payload.stepStatus,
    step_status: payload.stepStatus
  });
  const id = readId(data);
  if (!id) {
    throw new Error("Assessment step was saved without an id.");
  }
  return { id };
};

const normalizeTest = (raw: unknown): AssessmentTestData => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: readNumber(record, ["id"], 0),
    name: readString(record, ["name"], "Assessment Test"),
    category: readString(record, ["category"], "movement"),
    status: readNumber(record, ["status"], 0)
  };
};

export const fetchAssessmentTestList = async (sessionId: number) => {
  const data = await httpGet<unknown>(`/api/v1/assessment/test/list?session_id=${sessionId}`);
  const items = Array.isArray(data)
    ? data
    : isRecord(data)
    ? readArray(data, ["list", "items", "records"])
    : [];
  return items.map(normalizeTest).filter((item) => item.id > 0);
};

export const saveAssessmentTestResult = async (payload: {
  testId: number;
  score: number;
  note?: string;
}) => {
  const data = await httpPost<unknown>("/api/v1/assessment/test/result", {
    testId: payload.testId,
    test_id: payload.testId,
    score: payload.score,
    note: payload.note
  });
  const id = readId(data);
  if (!id) {
    throw new Error("Assessment result was saved without an id.");
  }
  return { id };
};

const normalizeJointMetric = (raw: unknown): JointMetricData => {
  const record = isRecord(raw) ? raw : {};
  return {
    joint: readString(record, ["joint"], "Unknown Joint"),
    mobility: readNumber(record, ["mobility"], 0),
    stability: readNumber(record, ["stability"], 0),
    motorControl: readNumber(record, ["motorControl", "motor_control"], 0),
    status: readNumber(record, ["status"], 0)
  };
};

const normalizeRiskAlert = (raw: unknown): RiskAlertData => {
  const record = isRecord(raw) ? raw : {};
  return {
    joint: readString(record, ["joint"], "Unknown Joint"),
    severity: readNumber(record, ["severity"], 0),
    message: readString(record, ["message"], "No details provided.")
  };
};

export const fetchAssessmentSummary = async (sessionId: number): Promise<AssessmentSummaryData> => {
  const data = await httpGet<unknown>(`/api/v1/assessment/result?session_id=${sessionId}`);
  const record = isRecord(data) ? data : {};
  const jointMetrics = readArray(record, ["jointMetrics", "joint_metrics"])
    .map(normalizeJointMetric)
    .filter((item) => item.joint);
  const riskAlerts = readArray(record, ["riskAlerts", "risk_alerts"])
    .map(normalizeRiskAlert)
    .filter((item) => item.joint);

  return {
    summary: readString(record, ["summary"], "No assessment summary available."),
    jointMetrics,
    riskAlerts
  };
};
