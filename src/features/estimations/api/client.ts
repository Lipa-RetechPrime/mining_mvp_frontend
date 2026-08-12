import {
  isAxiosError,
  type AxiosRequestConfig,
} from "axios";

import { apiClient, normalizeApiPath } from "@/shared/api/axios";

export type FetchFromBackendOptions = {
  method?: AxiosRequestConfig["method"];
  /** JSON body — serialized and sent with Content-Type: application/json */
  json?: unknown;
  body?: BodyInit | null;
  headers?: AxiosRequestConfig["headers"];
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
      if (
        body.length > 300 ||
        body.includes("<!DOCTYPE") ||
        body.includes("boundary:")
      ) {
        return null;
      }
      return body;
    }
    return null;
  }

  const record = body as { message?: unknown; error?: unknown };
  if (Array.isArray(record.message)) {
    return (
      record.message.filter((m) => typeof m === "string").join("\n") || null
    );
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

function toResponseHeaders(
  headers: Record<string, unknown>,
): Pick<Headers, "get"> {
  return {
    get(name: string) {
      const value =
        headers[name.toLowerCase()] ?? headers[name];
      if (Array.isArray(value)) {
        return value[0] ?? null;
      }
      return typeof value === "string" ? value : null;
    },
  };
}

async function readBlobErrorBody(data: unknown): Promise<unknown> {
  if (!(data instanceof Blob)) {
    return data;
  }

  try {
    const text = await data.text();
    if (!text) {
      return undefined;
    }

    const contentType = data.type;
    if (contentType.includes("application/json")) {
      return JSON.parse(text);
    }

    return text;
  } catch {
    return undefined;
  }
}

/**
 * Shared request helper for estimation / investments API calls.
 */
export async function fetchFromBackend<T>(
  endpoint: string,
  options: FetchFromBackendOptions = {},
): Promise<T> {
  const { json, headers, body, method, ...rest } = options;

  try {
    const response = await apiClient.request<T>({
      url: normalizeApiPath(endpoint),
      method: method ?? "GET",
      headers,
      data: json !== undefined ? json : (body ?? undefined),
      ...rest,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = String(response.headers["content-type"] ?? "");
    if (!contentType.includes("application/json")) {
      return undefined as T;
    }

    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      throw new BackendApiError(
        error.response.status,
        error.response.statusText,
        error.response.data,
      );
    }
    throw error;
  }
}

/** Binary download helper (e.g. Excel export). */
export async function fetchBlobFromBackend(
  endpoint: string,
  options: FetchFromBackendOptions = {},
): Promise<{ blob: Blob; headers: Pick<Headers, "get"> }> {
  const { json, headers, body, method, ...rest } = options;

  try {
    const response = await apiClient.request<Blob>({
      url: normalizeApiPath(endpoint),
      method: method ?? "GET",
      headers,
      data: json !== undefined ? json : (body ?? undefined),
      responseType: "blob",
      ...rest,
    });

    return {
      blob: response.data,
      headers: toResponseHeaders(
        response.headers as Record<string, unknown>,
      ),
    };
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      throw new BackendApiError(
        error.response.status,
        error.response.statusText,
        await readBlobErrorBody(error.response.data),
      );
    }
    throw error;
  }
}
