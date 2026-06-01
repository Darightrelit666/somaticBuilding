type ApiEnvelope<T> = {
  code?: number;
  data?: T;
  message?: string;
  msg?: string;
  error?: string;
};

const AUTH_TOKEN_STORAGE_KEY = "authToken";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseBody = async (response: Response): Promise<unknown> => {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

const extractMessage = (payload: unknown, fallback: string) => {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (isRecord(payload)) {
    const candidates = [
      payload.message,
      payload.msg,
      payload.error
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }
  return fallback;
};

const unwrapEnvelope = <T>(payload: unknown): T => {
  if (isRecord(payload) && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
};

const isSuccessCode = (code: unknown) => {
  if (code === undefined || code === null) return true;
  if (typeof code === "number") return code === 0 || code === 200;
  if (typeof code === "string") {
    const normalized = code.trim().toLowerCase();
    return normalized === "0" || normalized === "200" || normalized === "ok" || normalized === "success";
  }
  if (typeof code === "boolean") return code;
  return false;
};

const withAuthHeader = (init?: RequestInit): RequestInit | undefined => {
  if (typeof window === "undefined") return init;
  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) return init;

  const headers = new Headers(init?.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return {
    ...init,
    headers
  };
};

export const request = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(path, withAuthHeader(init));
  const payload = await parseBody(response);

  if (!response.ok) {
    throw new Error(extractMessage(payload, `Request failed: ${response.status}`));
  }

  if (isRecord(payload) && "code" in payload && !isSuccessCode(payload.code)) {
    throw new Error(extractMessage(payload, `API error: ${String(payload.code)}`));
  }

  return unwrapEnvelope<T>(payload);
};

export const httpGet = <T>(path: string) =>
  request<T>(path, {
    method: "GET"
  });

export const httpPost = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

export const httpPostForm = <T>(path: string, body: FormData) =>
  request<T>(path, {
    method: "POST",
    body
  });

export const httpPut = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

export const httpDelete = <T>(path: string) =>
  request<T>(path, {
    method: "DELETE"
  });
