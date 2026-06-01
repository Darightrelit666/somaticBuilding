import { httpGet, httpPost, httpPut } from "./http";

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

const readIdFromPayload = (payload: unknown) => {
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (typeof payload === "string") {
    const parsed = Number(payload);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (isRecord(payload)) {
    return readNumber(payload, ["id", "runId", "run_id"], 0);
  }
  return 0;
};

const readString = (source: UnknownRecord, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
};

export type TrainingRunSummary = {
  runId: number;
  sessionId: number;
  userId: number;
  runStatus: number;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  setLogCount: number;
  totalReps: number;
  totalWeightKg: number;
  totalSetDurationSeconds: number;
  timerLogCount: number;
  totalTimerDurationSeconds: number;
  distinctExerciseCount: number;
  skippedExerciseCount: number;
};

const normalizeTrainingRunSummary = (payload: unknown): TrainingRunSummary => {
  if (!isRecord(payload)) {
    throw new Error("Invalid training summary response.");
  }
  return {
    runId: readNumber(payload, ["runId", "run_id", "id"], 0),
    sessionId: readNumber(payload, ["sessionId", "session_id"], 0),
    userId: readNumber(payload, ["userId", "user_id"], 0),
    runStatus: readNumber(payload, ["runStatus", "run_status", "status"], 0),
    startTime: readString(payload, ["startTime", "start_time"], ""),
    endTime: readString(payload, ["endTime", "end_time"], ""),
    durationSeconds: readNumber(payload, ["durationSeconds", "duration_seconds"], 0),
    setLogCount: readNumber(payload, ["setLogCount", "set_log_count"], 0),
    totalReps: readNumber(payload, ["totalReps", "total_reps"], 0),
    totalWeightKg: readNumber(payload, ["totalWeightKg", "total_weight_kg"], 0),
    totalSetDurationSeconds: readNumber(
      payload,
      ["totalSetDurationSeconds", "total_set_duration_seconds"],
      0
    ),
    timerLogCount: readNumber(payload, ["timerLogCount", "timer_log_count"], 0),
    totalTimerDurationSeconds: readNumber(
      payload,
      ["totalTimerDurationSeconds", "total_timer_duration_seconds"],
      0
    ),
    distinctExerciseCount: readNumber(
      payload,
      ["distinctExerciseCount", "distinct_exercise_count"],
      0
    ),
    skippedExerciseCount: readNumber(
      payload,
      ["skippedExerciseCount", "skipped_exercise_count"],
      0
    )
  };
};

export const createTrainingRun = async (payload: {
  sessionId: number;
  userId: number;
}) => {
  const data = await httpPost<unknown>("/api/v1/training/run", {
    sessionId: payload.sessionId,
    session_id: payload.sessionId,
    userId: payload.userId,
    user_id: payload.userId
  });
  const id = readIdFromPayload(data);
  if (!id) {
    throw new Error("Training run was created without an id.");
  }
  return { id };
};

export const updateTrainingRunStatus = async (
  runId: number,
  statusOrPayload: number | { status?: number }
) => {
  const resolvedStatus =
    typeof statusOrPayload === "number"
      ? statusOrPayload
      : Number(statusOrPayload?.status ?? Number.NaN);

  if (!Number.isFinite(resolvedStatus)) {
    throw new Error("Training run status must be a finite number.");
  }

  await httpPut<unknown>(`/api/v1/training/run/${runId}`, {
    status: resolvedStatus
  });
};

export const createTrainingSetLog = async (payload: {
  runId: number;
  exerciseId: number;
  setIndex: number;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
}) => {
  await httpPost<unknown>("/api/v1/training/set-log", {
    runId: payload.runId,
    run_id: payload.runId,
    exerciseId: payload.exerciseId,
    exercise_id: payload.exerciseId,
    setIndex: payload.setIndex,
    set_index: payload.setIndex,
    reps: payload.reps,
    weightKg: payload.weightKg,
    weight_kg: payload.weightKg,
    durationSeconds: payload.durationSeconds,
    duration_seconds: payload.durationSeconds
  });
};

export const createTrainingExerciseLog = async (payload: {
  runId: number;
  exerciseId: number;
  startTime?: string;
  endTime?: string;
  note?: string;
}) => {
  await httpPost<unknown>("/api/v1/training/exercise-log", {
    runId: payload.runId,
    run_id: payload.runId,
    exerciseId: payload.exerciseId,
    exercise_id: payload.exerciseId,
    startTime: payload.startTime,
    start_time: payload.startTime,
    endTime: payload.endTime,
    end_time: payload.endTime,
    note: payload.note
  });
};

export const fetchTrainingRunSummary = async (runId: number): Promise<TrainingRunSummary> => {
  const response = await httpGet<unknown>(`/api/v1/training/run/${runId}/summary`);
  return normalizeTrainingRunSummary(response);
};

// Backward-compatible aliases for older modules.
export const startTrainingRun = async (payload: {
  sessionId: number;
  userId: number;
}) => {
  const { id } = await createTrainingRun(payload);
  return id;
};

export const createSetLog = createTrainingSetLog;
export const createExerciseLog = createTrainingExerciseLog;
