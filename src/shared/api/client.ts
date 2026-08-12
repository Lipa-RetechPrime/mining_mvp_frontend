import { isAxiosError, type AxiosRequestConfig } from "axios";

import { apiClient, normalizeApiPath } from "./axios";
import { ApiError, type FieldErrors } from "./errors";

export { apiClient } from "./axios";

export interface ApiRequestOptions {
  method?: AxiosRequestConfig["method"];
  json?: unknown;
  body?: BodyInit | null;
  headers?: AxiosRequestConfig["headers"];
}

interface ErrorPayload {
  message?: unknown;
  fieldErrors?: unknown;
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

export async function apiRequest<T>(
  path: string,
  { json, headers, body, method }: ApiRequestOptions = {},
): Promise<T> {
  try {
    const response = await apiClient.request<T>({
      url: normalizeApiPath(path),
      method: method ?? "GET",
      headers,
      data: json !== undefined ? json : (body ?? undefined),
    });

    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response) {
      const payload = error.response.data;
      const details =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as ErrorPayload)
          : undefined;

      throw new ApiError({
        status: error.response.status,
        message:
          typeof details?.message === "string"
            ? details.message
            : "The request could not be completed.",
        fieldErrors: readFieldErrors(details?.fieldErrors),
      });
    }

    throw error;
  }
}
