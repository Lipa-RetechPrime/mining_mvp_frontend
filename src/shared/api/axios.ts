import axios from "axios";

import { env } from "@/shared/config/env";

function resolveBaseUrl(): string {
  if (env.apiBaseUrl) {
    return env.apiBaseUrl;
  }

  const proxyUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (proxyUrl) {
    return proxyUrl.replace(/\/$/, "");
  }

  return "/api";
}

/** Shared axios instance for all browser API calls. */
export const apiClient = axios.create({
  baseURL: resolveBaseUrl(),
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

/** Axios treats leading `/` as origin-root absolute — strip so baseURL applies. */
export function normalizeApiPath(path: string): string {
  return path.replace(/^\/+/, "");
}
