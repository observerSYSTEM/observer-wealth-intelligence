const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
const defaultApiUrl = process.env.NODE_ENV === "production" ? "" : "http://localhost:8000";

export const apiBaseUrl = (configuredApiUrl ?? defaultApiUrl).replace(/\/$/, "");

type ApiFetchOptions = {
  retryOnUnauthorized?: boolean;
};

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function csrfToken() {
  return readCookie("owi_csrf_token");
}

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string") return payload.detail;
    if (Array.isArray(payload.detail)) return "Please check the highlighted fields.";
    return "Request failed.";
  } catch {
    return "Request failed.";
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession() {
  refreshPromise ??= apiFetch("/api/v1/auth/refresh", { method: "POST" }, { retryOnUnauthorized: false })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<T> {
  const retryOnUnauthorized = options.retryOnUnauthorized ?? true;
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();

  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const csrf = csrfToken();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrf) {
    headers.set("X-CSRF-Token", csrf);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include"
  });

  if (response.status === 401 && retryOnUnauthorized && path !== "/api/v1/auth/refresh") {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch<T>(path, init, { retryOnUnauthorized: false });
    }
    window.dispatchEvent(new CustomEvent("owi:session-expired"));
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include"
  });
  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }
  return response.blob();
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.detail : "Something went wrong.";
}
