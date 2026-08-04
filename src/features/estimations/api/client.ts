/**
 * Browser base path. Default `/api` is proxied by next.config rewrites to the Nest backend
 * (same as the Vite `/api` → backend rewrite).
 * Override with NEXT_PUBLIC_API_URL only when calling the backend directly.
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "/api";

export type FetchFromBackendOptions = Omit<RequestInit, "body"> & {
  /** JSON body — serialized and sent with Content-Type: application/json */
  json?: unknown;
  body?: BodyInit | null;
};

export class BackendApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    const message =
      readErrorMessage(body) || `API Error: ${status} ${statusText}`;
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.body = body;
  }
}

function isNextNotFoundPayload(value: unknown): boolean {
  if (typeof value === "string") {
    return (
      value.includes("boundary:not-found") ||
      value.includes('"pagePath":"/not-found"') ||
      value.includes("The page could not be found")
    );
  }
  if (!value || typeof value !== "object") return false;
  try {
    return isNextNotFoundPayload(JSON.stringify(value));
  } catch {
    return false;
  }
}

function readErrorMessage(body: unknown): string | null {
  if (isNextNotFoundPayload(body)) {
    return "API proxy returned 404. Is the Nest server running, and did you restart `next dev` after changing next.config / API_PROXY_TARGET?";
  }

  if (!body || typeof body !== "object") {
    if (typeof body === "string" && body.trim()) {
      // Avoid dumping huge HTML / RSC payloads into the UI.
      if (body.length > 300 || body.includes("<!DOCTYPE") || body.includes("boundary:")) {
        return null;
      }
      return body;
    }
    return null;
  }

  const record = body as { message?: unknown; error?: unknown };
  if (Array.isArray(record.message)) {
    return record.message.filter((m) => typeof m === "string").join("\n") || null;
  }
  if (typeof record.message === "string" && record.message.trim()) {
    if (isNextNotFoundPayload(record.message)) {
      return "API proxy returned 404. Is the Nest server running, and did you restart `next dev` after changing next.config / API_PROXY_TARGET?";
    }
    return record.message;
  }
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }
  return null;
}

function buildUrl(endpoint: string): string {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
}

function buildHeaders(
  headers: HeadersInit | undefined,
  hasJsonBody: boolean,
): Headers {
  const next = new Headers(headers);
  if (hasJsonBody && !next.has("Content-Type")) {
    next.set("Content-Type", "application/json");
  }
  if (!next.has("Accept")) {
    next.set("Accept", "application/json");
  }
  return next;
}

async function readErrorBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return text || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Shared fetch helper for estimation / investments API calls.
 */
export async function fetchFromBackend<T>(
  endpoint: string,
  options: FetchFromBackendOptions = {},
): Promise<T> {
  const { json, headers, body, ...rest } = options;
  const hasJson = json !== undefined;
  const response = await fetch(buildUrl(endpoint), {
    ...rest,
    headers: buildHeaders(headers, hasJson),
    body: hasJson ? JSON.stringify(json) : body,
  });

  if (!response.ok) {
    throw new BackendApiError(
      response.status,
      response.statusText,
      await readErrorBody(response),
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Binary download helper (e.g. Excel export). */
export async function fetchBlobFromBackend(
  endpoint: string,
  options: FetchFromBackendOptions = {},
): Promise<{ blob: Blob; headers: Headers }> {
  const { json, headers, body, ...rest } = options;
  const hasJson = json !== undefined;
  const response = await fetch(buildUrl(endpoint), {
    ...rest,
    headers: buildHeaders(headers, hasJson),
    body: hasJson ? JSON.stringify(json) : body,
  });

  if (!response.ok) {
    throw new BackendApiError(
      response.status,
      response.statusText,
      await readErrorBody(response),
    );
  }

  return {
    blob: await response.blob(),
    headers: response.headers,
  };
}
