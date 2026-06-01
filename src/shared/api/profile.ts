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

export type UserProfileData = {
  displayName: string;
  gender: number;
  age: number;
  heightCm: number;
  weightKg: number;
  trainingYears: number;
  lifestyleNote: string;
};

export type AbilityProfileData = {
  strength: number;
  power: number;
  endurance: number;
  mobility: number;
  stability: number;
  speed: number;
};

export type AbilityHistoryData = AbilityProfileData & {
  recordTime: string;
};

export type TrainingHistoryItem = {
  runId: number;
  sessionId: number;
  startTime: string;
  endTime: string;
};

export type DisplayNameAvailabilityData = {
  available: boolean;
  displayName: string;
};

export type UserProfileUpdatePayload = {
  userId: number;
  displayName?: string;
  gender?: number;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  trainingYears?: number;
  lifestyleNote?: string;
};

export type AbilityProfileCreatePayload = {
  userId: number;
  strength: number;
  power: number;
  endurance: number;
  mobility: number;
  stability: number;
  speed: number;
};

const normalizeUserProfile = (raw: unknown): UserProfileData => {
  const record = isRecord(raw) ? raw : {};
  return {
    displayName: readString(record, ["displayName", "display_name"], "Athlete"),
    gender: readNumber(record, ["gender"], 0),
    age: readNumber(record, ["age"], 0),
    heightCm: readNumber(record, ["heightCm", "height_cm"], 0),
    weightKg: readNumber(record, ["weightKg", "weight_kg"], 0),
    trainingYears: readNumber(record, ["trainingYears", "training_years"], 0),
    lifestyleNote: readString(record, ["lifestyleNote", "lifestyle_note"], "")
  };
};

const normalizeAbilityProfile = (raw: unknown): AbilityProfileData => {
  const record = isRecord(raw) ? raw : {};
  return {
    strength: readNumber(record, ["strength"], 0),
    power: readNumber(record, ["power"], 0),
    endurance: readNumber(record, ["endurance"], 0),
    mobility: readNumber(record, ["mobility"], 0),
    stability: readNumber(record, ["stability"], 0),
    speed: readNumber(record, ["speed"], 0)
  };
};

const normalizeAbilityHistory = (raw: unknown): AbilityHistoryData => {
  const record = isRecord(raw) ? raw : {};
  return {
    ...normalizeAbilityProfile(record),
    recordTime: readString(record, ["recordTime", "record_time"], "")
  };
};

const normalizeTrainingHistoryItem = (raw: unknown): TrainingHistoryItem => {
  const record = isRecord(raw) ? raw : {};
  return {
    runId: readNumber(record, ["runId", "run_id"], 0),
    sessionId: readNumber(record, ["sessionId", "session_id"], 0),
    startTime: readString(record, ["startTime", "start_time"], ""),
    endTime: readString(record, ["endTime", "end_time"], "")
  };
};

const normalizeDisplayNameAvailability = (raw: unknown): DisplayNameAvailabilityData => {
  const record = isRecord(raw) ? raw : {};
  return {
    available: Boolean(record.available),
    displayName: readString(record, ["displayName", "display_name"], "")
  };
};

export const fetchUserProfile = async (userId: number) => {
  const data = await httpGet<unknown>(`/api/v1/user/profile?user_id=${userId}`);
  return normalizeUserProfile(data);
};

export const updateUserProfile = async (payload: UserProfileUpdatePayload) => {
  await httpPut<unknown>("/api/v1/user/profile", {
    userId: payload.userId,
    user_id: payload.userId,
    displayName: payload.displayName,
    display_name: payload.displayName,
    gender: payload.gender,
    age: payload.age,
    heightCm: payload.heightCm,
    height_cm: payload.heightCm,
    weightKg: payload.weightKg,
    weight_kg: payload.weightKg,
    trainingYears: payload.trainingYears,
    training_years: payload.trainingYears,
    lifestyleNote: payload.lifestyleNote,
    lifestyle_note: payload.lifestyleNote
  });
};

export const fetchAbilityProfileLatest = async (userId: number) => {
  const data = await httpGet<unknown>(`/api/v1/ability/profile/latest?user_id=${userId}`);
  return normalizeAbilityProfile(data);
};

export const createAbilityProfile = async (payload: AbilityProfileCreatePayload) => {
  await httpPost<unknown>("/api/v1/ability/profile", {
    userId: payload.userId,
    user_id: payload.userId,
    strength: payload.strength,
    power: payload.power,
    endurance: payload.endurance,
    mobility: payload.mobility,
    stability: payload.stability,
    speed: payload.speed
  });
};

export const fetchAbilityHistory = async (userId: number) => {
  const data = await httpGet<unknown>(`/api/v1/ability/history?user_id=${userId}`);
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
    ? readArray(data, ["list", "items", "records"])
    : [];
  return list
    .map(normalizeAbilityHistory)
    .filter((item) => item.recordTime);
};

export const fetchTrainingHistory = async (userId: number, pageSize = 20) => {
  const data = await httpGet<unknown>(
    `/api/v1/training/history?user_id=${userId}&page=1&page_size=${pageSize}`
  );
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
    ? readArray(data, ["list", "items", "records"])
    : [];
  return list
    .map(normalizeTrainingHistoryItem)
    .filter((item) => item.runId > 0);
};

export const checkDisplayNameAvailability = async (payload: {
  userId?: number;
  displayName: string;
}) => {
  const query = payload.userId
    ? `/api/v1/user/profile/display-name/availability?display_name=${encodeURIComponent(payload.displayName)}&user_id=${payload.userId}`
    : `/api/v1/user/profile/display-name/availability?display_name=${encodeURIComponent(payload.displayName)}`;
  const data = await httpGet<unknown>(query);
  return normalizeDisplayNameAvailability(data);
};
