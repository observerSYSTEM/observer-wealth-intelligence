const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
const defaultApiUrl = process.env.NODE_ENV === "production" ? "" : "http://localhost:8000";
const apiVersionPath = "/api/v1";

function trimTrailingSlashes(value: string) {
  let end = value.length;
  while (end > 1 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

function startsWithApiSegment(pathname: string) {
  return pathname.split("/").filter(Boolean)[0] === "api";
}

function normalizeApiBaseOrigin(value: string | undefined) {
  const configured = value?.trim();
  const candidate = configured || defaultApiUrl;
  if (!candidate) return "";

  if (startsWithApiSegment(candidate)) {
    return "";
  }

  try {
    const url = new URL(candidate);
    if (url.pathname === "/" || startsWithApiSegment(url.pathname)) {
      return url.origin;
    }
    return trimTrailingSlashes(`${url.origin}${url.pathname}`);
  } catch {
    return trimTrailingSlashes(candidate);
  }
}

function canonicalApiPath(path: string) {
  const [pathWithoutHash, hash = ""] = path.split("#", 2);
  const [pathname, query = ""] = pathWithoutHash.split("?", 2);
  const segments = pathname.split("/").filter(Boolean);

  while (segments[0] === "api") {
    segments.shift();
  }
  if (segments[0] === "v1") {
    segments.shift();
  }

  const suffix = segments.length ? `/${segments.join("/")}` : "";
  const querySuffix = query ? `?${query}` : "";
  const hashSuffix = hash ? `#${hash}` : "";
  return `${apiVersionPath}${suffix}${querySuffix}${hashSuffix}`;
}

function canonicalResourcePath(path: string) {
  const canonicalPath = canonicalApiPath(path);
  const resourcePrefix = `${apiVersionPath}/`;
  if (canonicalPath === apiVersionPath) return "";
  return canonicalPath.startsWith(resourcePrefix)
    ? canonicalPath.slice(resourcePrefix.length)
    : canonicalPath;
}

const apiBaseOrigin = normalizeApiBaseOrigin(configuredApiUrl);

export function apiUrl(path: string) {
  return `${apiBaseOrigin}${canonicalApiPath(path)}`;
}

type ApiFetchOptions = {
  retryOnUnauthorized?: boolean;
};

type ErrorContext = "auth" | "form" | "upload" | "ocr" | "backup";

type CachedPayload<T> = {
  storedAt: string;
  value: T;
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

const offlineCachePrefix = "owi:offline:";
const cacheableReadPrefixes = [
  "dashboard/summary",
  "goals",
  "timeline",
  "portfolio/summary",
  "assets",
  "receipts",
  "vault",
  "notifications"
];

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function cacheKey(path: string) {
  return `${offlineCachePrefix}${canonicalResourcePath(path)}`;
}

function isCacheableRead(path: string, method: string) {
  const resourcePath = canonicalResourcePath(path);
  return method === "GET" && cacheableReadPrefixes.some((prefix) => resourcePath.startsWith(prefix));
}

function readCached<T>(path: string): T | null {
  if (!canUseBrowserStorage()) return null;
  const raw = window.localStorage.getItem(cacheKey(path));
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as CachedPayload<T>).value;
  } catch {
    window.localStorage.removeItem(cacheKey(path));
    return null;
  }
}

function writeCached<T>(path: string, value: T) {
  if (!canUseBrowserStorage()) return;
  window.localStorage.setItem(
    cacheKey(path),
    JSON.stringify({ storedAt: new Date().toISOString(), value } satisfies CachedPayload<T>)
  );
}

export function clearOfflineCache() {
  if (!canUseBrowserStorage()) return;
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith(offlineCachePrefix)) {
      window.localStorage.removeItem(key);
    }
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
  refreshPromise ??= apiFetch("auth/refresh", { method: "POST" }, { retryOnUnauthorized: false })
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
  const resourcePath = canonicalResourcePath(path);
  const cacheable = isCacheableRead(resourcePath, method);

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && isOffline()) {
    throw new ApiError(0, "You are offline. Reconnect before changing private data.");
  }

  if (cacheable && isOffline()) {
    const cached = readCached<T>(resourcePath);
    if (cached !== null) return cached;
  }

  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const csrf = csrfToken();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrf) {
    headers.set("X-CSRF-Token", csrf);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      method,
      headers,
      credentials: "include"
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("OWI API network failure", { path, method, error });
    }
    if (cacheable) {
      const cached = readCached<T>(resourcePath);
      if (cached !== null) return cached;
    }
    throw new ApiError(0, "Network request failed. Check the backend connection.");
  }

  if (response.status === 401 && retryOnUnauthorized && resourcePath !== "auth/refresh") {
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
  const payload = (await response.json()) as T;
  if (cacheable) writeCached(resourcePath, payload);
  return payload;
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(apiUrl(path), {
    credentials: "include"
  });
  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }
  return response.blob();
}

export function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";

  const detail = error.detail || "Request failed.";
  if (error.status === 0) {
    return "OWI cannot reach the API. Check the Raspberry Pi service and network connection, then try again.";
  }
  if (error.status === 401) {
    return detail === "Invalid email or password"
      ? detail
      : "Your session has expired. Please sign in again.";
  }
  if (error.status === 403) {
    return "You do not have permission to complete this action.";
  }
  if (error.status === 413) {
    return "The selected file is too large for the configured upload limit.";
  }
  if (error.status === 422) {
    return "Some fields need attention. Check the form values and try again.";
  }
  if (error.status >= 500) {
    return "OWI hit a server error. Check diagnostics or logs, then try again.";
  }
  return detail;
}

export function contextualErrorMessage(error: unknown, context: ErrorContext) {
  const message = errorMessage(error);
  if (context === "auth" && error instanceof ApiError && error.status === 401) {
    return `Authentication failed. ${error.detail}`;
  }
  if (error instanceof ApiError && [0, 401, 403, 413, 422].includes(error.status)) {
    return message;
  }

  if (context === "auth") return `Authentication failed. ${message}`;
  if (context === "form") return `The form could not be saved. ${message}`;
  if (context === "upload") return `Upload failed. ${message}`;
  if (context === "ocr") return `OCR action failed. ${message}`;
  return `Backup action failed. ${message}`;
}
