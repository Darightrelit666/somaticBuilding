import { httpDelete, httpGet, httpPost, httpPut } from "./http";

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
    if (typeof value === "string" && value.length > 0) return value;
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

const readIdFromPayload = (payload: unknown) => {
  if (typeof payload === "number" && Number.isFinite(payload)) return payload;
  if (typeof payload === "string") {
    const parsed = Number(payload);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (isRecord(payload)) {
    return readNumber(payload, ["id", "sessionId", "session_id", "groupId", "group_id"], 0);
  }
  return 0;
};

const normalizeGroupType = (method: string) => {
  switch (method) {
    case "Superset":
      return "superset";
    case "Circuit":
      return "circuit";
    case "Interval":
      return "interval";
    case "HIIT":
      return "hiit";
    default:
      return "straight";
  }
};

export type WorkoutSessionExercise = {
  id: number;
  exerciseId: number;
  exerciseName: string;
  sets: number;
  reps: number;
  restSeconds: number;
  timeSeconds: number;
  rounds: number;
  orderIndex: number;
};

export type WorkoutSessionGroup = {
  id: number;
  groupType: string;
  orderIndex: number;
  exercises: WorkoutSessionExercise[];
};

export type WorkoutSessionBlock = {
  id: number;
  blockName: string;
  orderIndex: number;
  groups: WorkoutSessionGroup[];
};

export type WorkoutSession = {
  id: number;
  sessionName: string;
  trainingStyle: string;
  blocks: WorkoutSessionBlock[];
};

export type WorkoutTemplateKind = "module" | "course";

export type WorkoutTemplateExercise = {
  exerciseId: number;
  sets: number;
  reps: number;
  restSeconds: number;
  timeSeconds: number;
  rounds: number;
  orderIndex: number;
};

export type WorkoutTemplateSummary = {
  id: number;
  templateName: string;
  templateKind: WorkoutTemplateKind;
  shareCode?: string;
  sharePath?: string;
};

export type WorkoutTemplateDetail = WorkoutTemplateSummary & {
  exercises: WorkoutTemplateExercise[];
};

type CreateWorkoutSessionInput = {
  userId: number;
  sessionName: string;
  trainingStyle: string;
  blockNames?: string[];
  templateId?: number;
};

type CreateWorkoutGroupInput = {
  blockId: number;
  method: string;
  orderIndex: number;
};

type CreateWorkoutExerciseInput = {
  groupId: number;
  exerciseId: number;
  sets: number;
  reps: number;
  restSeconds: number;
  timeSeconds: number;
  rounds: number;
  orderIndex: number;
};

export const createWorkoutSession = async ({
  userId,
  sessionName,
  trainingStyle,
  blockNames,
  templateId
}: CreateWorkoutSessionInput) => {
  const payload: UnknownRecord = {
    userId,
    user_id: userId,
    sessionName,
    session_name: sessionName,
    trainingStyle,
    training_style: trainingStyle
  };
  if (Array.isArray(blockNames) && blockNames.length > 0) {
    payload.blockNames = blockNames;
    payload.block_names = blockNames;
  }
  if (typeof templateId === "number" && Number.isFinite(templateId)) {
    payload.templateId = templateId;
    payload.template_id = templateId;
  }

  const data = await httpPost<unknown>("/api/v1/workout/session", payload);
  const id = readIdFromPayload(data);
  if (!id) {
    throw new Error("Workout session was created without an id.");
  }
  return { id };
};

const normalizeExercise = (raw: unknown): WorkoutSessionExercise => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: readNumber(record, ["id"], 0),
    exerciseId: readNumber(record, ["exerciseId", "exercise_id"], 0),
    exerciseName: readString(record, ["exerciseName", "exercise_name", "name"], ""),
    sets: readNumber(record, ["sets"], 0),
    reps: readNumber(record, ["reps"], 0),
    restSeconds: readNumber(record, ["restSeconds", "rest_seconds"], 0),
    timeSeconds: readNumber(record, ["timeSeconds", "time_seconds"], 0),
    rounds: readNumber(record, ["rounds"], 0),
    orderIndex: readNumber(record, ["orderIndex", "order_index"], 0)
  };
};

const normalizeGroup = (raw: unknown): WorkoutSessionGroup => {
  const record = isRecord(raw) ? raw : {};
  const exercises = readArray(record, ["exercises"])
    .map(normalizeExercise)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return {
    id: readNumber(record, ["id"], 0),
    groupType: readString(record, ["groupType", "group_type"], "straight"),
    orderIndex: readNumber(record, ["orderIndex", "order_index"], 0),
    exercises
  };
};

const normalizeBlock = (raw: unknown): WorkoutSessionBlock => {
  const record = isRecord(raw) ? raw : {};
  const groups = readArray(record, ["groups"])
    .map(normalizeGroup)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return {
    id: readNumber(record, ["id"], 0),
    blockName: readString(record, ["blockName", "block_name", "name"], "Block"),
    orderIndex: readNumber(record, ["orderIndex", "order_index"], 0),
    groups
  };
};

export const getWorkoutSession = async (sessionId: number): Promise<WorkoutSession> => {
  const data = await httpGet<unknown>(`/api/v1/workout/session/${sessionId}`);
  const record = isRecord(data) ? data : {};
  const blocks = readArray(record, ["blocks"])
    .map(normalizeBlock)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return {
    id: readNumber(record, ["id", "sessionId", "session_id"], sessionId),
    sessionName: readString(record, ["sessionName", "session_name"], "Training Session"),
    trainingStyle: readString(
      record,
      ["trainingStyle", "training_style"],
      "Strength & Conditioning"
    ),
    blocks
  };
};

export const updateWorkoutSession = async (
  sessionId: number,
  payload: { sessionName: string; trainingStyle: string }
) => {
  await httpPut<unknown>(`/api/v1/workout/session/${sessionId}`, {
    sessionName: payload.sessionName,
    session_name: payload.sessionName,
    trainingStyle: payload.trainingStyle,
    training_style: payload.trainingStyle
  });
};

export const createWorkoutGroup = async ({
  blockId,
  method,
  orderIndex
}: CreateWorkoutGroupInput) => {
  const groupType = normalizeGroupType(method);
  const data = await httpPost<unknown>("/api/v1/workout/group", {
    blockId,
    block_id: blockId,
    groupType,
    group_type: groupType,
    orderIndex,
    order_index: orderIndex
  });
  const id = readIdFromPayload(data);
  if (!id) {
    throw new Error("Workout group was created without an id.");
  }
  return { id };
};

export const createWorkoutExercise = async ({
  groupId,
  exerciseId,
  sets,
  reps,
  restSeconds,
  timeSeconds,
  rounds,
  orderIndex
}: CreateWorkoutExerciseInput) => {
  const data = await httpPost<unknown>("/api/v1/workout/exercise", {
    groupId,
    group_id: groupId,
    exerciseId,
    exercise_id: exerciseId,
    sets,
    reps,
    restSeconds,
    rest_seconds: restSeconds,
    timeSeconds,
    time_seconds: timeSeconds,
    rounds,
    orderIndex,
    order_index: orderIndex
  });
  const id = readIdFromPayload(data);
  if (!id) {
    throw new Error("Workout exercise was created without an id.");
  }
  return { id };
};

const normalizeTemplateKind = (value: unknown): WorkoutTemplateKind => {
  if (typeof value === "string" && value.trim().toLowerCase() === "module") {
    return "module";
  }
  return "course";
};

const normalizeTemplateExercise = (raw: unknown): WorkoutTemplateExercise => {
  const record = isRecord(raw) ? raw : {};
  return {
    exerciseId: readNumber(record, ["exerciseId", "exercise_id"], 0),
    sets: readNumber(record, ["sets"], 0),
    reps: readNumber(record, ["reps"], 0),
    restSeconds: readNumber(record, ["restSeconds", "rest_seconds"], 0),
    timeSeconds: readNumber(record, ["timeSeconds", "time_seconds"], 0),
    rounds: readNumber(record, ["rounds"], 0),
    orderIndex: readNumber(record, ["orderIndex", "order_index"], 0)
  };
};

const normalizeTemplateSummary = (raw: unknown): WorkoutTemplateSummary => {
  const record = isRecord(raw) ? raw : {};
  const shareCode = readString(record, ["shareCode", "share_code"], "");
  const sharePath = readString(record, ["sharePath", "share_path"], "");
  return {
    id: readNumber(record, ["id"], 0),
    templateName: readString(record, ["templateName", "template_name"], "Untitled Template"),
    templateKind: normalizeTemplateKind(
      record.templateKind ?? record.template_kind ?? record.kind
    ),
    shareCode: shareCode || undefined,
    sharePath: sharePath || undefined
  };
};

export const fetchWorkoutTemplateList = async (
  userId: number,
  kind: WorkoutTemplateKind | "all" = "all"
): Promise<WorkoutTemplateSummary[]> => {
  const query = new URLSearchParams();
  query.set("user_id", String(userId));
  query.set("kind", kind);
  const data = await httpGet<unknown>(`/api/v1/workout/template/list?${query.toString()}`);
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
      ? readArray(data, ["list", "items", "records"])
      : [];
  return list.map(normalizeTemplateSummary);
};

export const fetchWorkoutTemplateDetail = async (
  templateId: number
): Promise<WorkoutTemplateDetail> => {
  const data = await httpGet<unknown>(`/api/v1/workout/template/${templateId}`);
  const record = isRecord(data) ? data : {};
  const exercises = readArray(record, ["exercises"])
    .map(normalizeTemplateExercise)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return {
    ...normalizeTemplateSummary(record),
    exercises
  };
};

export type WorkoutTemplateShareInfo = {
  id: number;
  templateName: string;
  templateKind: WorkoutTemplateKind;
  shareCode: string;
  sharePath: string;
};

export const fetchWorkoutTemplateShareInfo = async (
  templateId: number
): Promise<WorkoutTemplateShareInfo> => {
  const data = await httpGet<unknown>(`/api/v1/workout/template/${templateId}/share`);
  const record = isRecord(data) ? data : {};
  const summary = normalizeTemplateSummary(record);
  const shareCode = readString(record, ["shareCode", "share_code"], "");
  const sharePath = readString(record, ["sharePath", "share_path"], "");
  if (!summary.id || !shareCode || !sharePath) {
    throw new Error("Share info is incomplete.");
  }
  return {
    id: summary.id,
    templateName: summary.templateName,
    templateKind: summary.templateKind,
    shareCode,
    sharePath
  };
};

export const fetchSharedWorkoutTemplateDetail = async (
  shareCode: string
): Promise<WorkoutTemplateDetail> => {
  const safeCode = String(shareCode ?? "").trim();
  if (!safeCode) {
    throw new Error("Share code is required.");
  }
  const data = await httpGet<unknown>(`/api/v1/workout/template/share/${safeCode}`);
  const record = isRecord(data) ? data : {};
  const exercises = readArray(record, ["exercises"])
    .map(normalizeTemplateExercise)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  return {
    ...normalizeTemplateSummary(record),
    exercises
  };
};

export const createWorkoutTemplate = async (payload: {
  userId: number;
  templateName: string;
  templateKind?: WorkoutTemplateKind;
  exercises?: WorkoutTemplateExercise[];
}) => {
  const data = await httpPost<unknown>("/api/v1/workout/template", {
    userId: payload.userId,
    user_id: payload.userId,
    templateName: payload.templateName,
    template_name: payload.templateName,
    templateKind: payload.templateKind ?? "course",
    template_kind: payload.templateKind ?? "course",
    exercises: payload.exercises?.map((item) => ({
      exerciseId: item.exerciseId,
      exercise_id: item.exerciseId,
      sets: item.sets,
      reps: item.reps,
      restSeconds: item.restSeconds,
      rest_seconds: item.restSeconds,
      timeSeconds: item.timeSeconds,
      time_seconds: item.timeSeconds,
      rounds: item.rounds,
      orderIndex: item.orderIndex,
      order_index: item.orderIndex
    }))
  });
  const id = readIdFromPayload(data);
  if (!id) {
    throw new Error("Workout template was created without an id.");
  }
  return { id };
};

export const updateWorkoutTemplate = async (
  templateId: number,
  payload: {
    templateName?: string;
    templateKind?: WorkoutTemplateKind;
    exercises?: WorkoutTemplateExercise[];
  }
) => {
  await httpPut<unknown>(`/api/v1/workout/template/${templateId}`, {
    templateName: payload.templateName,
    template_name: payload.templateName,
    templateKind: payload.templateKind,
    template_kind: payload.templateKind,
    exercises: payload.exercises?.map((item) => ({
      exerciseId: item.exerciseId,
      exercise_id: item.exerciseId,
      sets: item.sets,
      reps: item.reps,
      restSeconds: item.restSeconds,
      rest_seconds: item.restSeconds,
      timeSeconds: item.timeSeconds,
      time_seconds: item.timeSeconds,
      rounds: item.rounds,
      orderIndex: item.orderIndex,
      order_index: item.orderIndex
    }))
  });
};

export const deleteWorkoutTemplate = async (templateId: number) => {
  await httpDelete<unknown>(`/api/v1/workout/template/${templateId}`);
};
