import { httpPost } from "./http";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const readString = (source: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const pickToken = (payload: unknown) => {
  if (!isRecord(payload)) return "";
  return readString(payload, ["token", "accessToken", "access_token"]);
};

export const AUTH_TOKEN_STORAGE_KEY = "authToken";
export const AUTH_DISPLAY_NAME_STORAGE_KEY = "authDisplayName";
export const AUTH_TOKEN_CHANGED_EVENT = "auth-token-changed";

export const emitAuthStateChanged = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
};

export const saveAuthToken = (token: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  emitAuthStateChanged();
};

export const clearAuthToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  emitAuthStateChanged();
};

export const loginWithPassword = async (payload: {
  account: string;
  password: string;
}) => {
  const data = await httpPost<unknown>("/api/v1/auth/login", {
    account: payload.account,
    password: payload.password
  });
  const token = pickToken(data);
  if (!token) {
    throw new Error("Login succeeded but token is missing.");
  }
  return { token };
};

export const registerWithPassword = async (payload: {
  password: string;
  email?: string;
  phone?: string;
}) => {
  const request: UnknownRecord = {
    password: payload.password
  };
  if (payload.email) {
    request.email = payload.email;
  }
  if (payload.phone) {
    request.phone = payload.phone;
  }

  const data = await httpPost<unknown>("/api/v1/auth/register", request);
  const token = pickToken(data);
  if (!token) {
    throw new Error("Register succeeded but token is missing.");
  }
  return { token };
};
