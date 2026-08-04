import { env } from "@/shared/config/env";

import { ApiError, type FieldErrors } from "./errors";

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | null;
  json?: unknown;
}

interface ErrorPayload {
  message?: unknown;
  fieldErrors?: unknown;
}

function buildUrl(path: string): string {
  if (!env.apiBaseUrl) {
    throw new Error(
      "The API base URL is not configured. Set NEXT_PUBLIC_API_BASE_URL before making API requests.",
    );
  }

  return `${env.apiBaseUrl}/${path.replace(/^\/+/, "")}`;
}

function readFieldErrors(value: unknown): FieldErrors | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([field, messages]) => {
    if (!Array.isArray(messages)) {
      return [];
    }

    const strings = messages.filter(
      (message): message is string => typeof message === "string",
    );

    return strings.length > 0 ? [[field, strings] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || undefined;
}

export async function apiRequest<T>(
  path: string,
  { json, headers, ...init }: ApiRequestOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");

  if (json !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    body: json === undefined ? init.body : JSON.stringify(json),
    credentials: init.credentials ?? "include",
    headers: requestHeaders,
  });

  const payload = await readPayload(response);

  if (!response.ok) {
    const details =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as ErrorPayload)
        : undefined;

    throw new ApiError({
      status: response.status,
      message:
        typeof details?.message === "string"
          ? details.message
          : "The request could not be completed.",
      fieldErrors: readFieldErrors(details?.fieldErrors),
    });
  }

  return payload as T;
}
