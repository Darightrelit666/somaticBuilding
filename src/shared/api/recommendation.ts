import { httpGet } from "./http";

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

export type RecommendationItem = {
  id: number;
  recType: string;
  refId: number;
  reason: string;
};

const normalizeRecommendation = (raw: unknown): RecommendationItem => {
  const record = isRecord(raw) ? raw : {};
  return {
    id: readNumber(record, ["id"], 0),
    recType: readString(record, ["recType", "rec_type"], ""),
    refId: readNumber(record, ["refId", "ref_id"], 0),
    reason: readString(record, ["reason"], "")
  };
};

export const fetchRecommendations = async (userId: number) => {
  const data = await httpGet<unknown>(`/api/v1/recommendation?user_id=${userId}`);
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
      ? readArray(data, ["list", "items", "records"])
      : [];
  return list
    .map(normalizeRecommendation)
    .filter((item) => item.id > 0 || item.refId > 0 || item.reason);
};
