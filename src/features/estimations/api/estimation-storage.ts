import type { Estimation } from "../types/estimation";

const STORAGE_KEY = "mce-estimation-list";
export const ESTIMATION_LIST_EVENT = "mce-estimations-changed";

const EMPTY_LIST: Estimation[] = [];

let cachedRaw: string | null = null;
let cachedList: Estimation[] = EMPTY_LIST;

function isEstimation(value: unknown): value is Estimation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<Estimation>;
  return typeof item.siteSubtitle === "string" && Array.isArray(item.blocks);
}

function parseEstimations(raw: string | null): Estimation[] {
  if (!raw) {
    return EMPTY_LIST;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return EMPTY_LIST;
    }

    const items = parsed.filter(isEstimation);
    return items.length > 0 ? items : EMPTY_LIST;
  } catch {
    return EMPTY_LIST;
  }
}

/** Stable snapshot for useSyncExternalStore — same reference until storage changes. */
export function getEstimationListSnapshot(): Estimation[] {
  if (typeof window === "undefined") {
    return EMPTY_LIST;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (raw === cachedRaw) {
    return cachedList;
  }

  cachedRaw = raw;
  cachedList = parseEstimations(raw);
  return cachedList;
}

export function getServerEstimationListSnapshot(): Estimation[] {
  return EMPTY_LIST;
}

export function readStoredEstimations(): Estimation[] {
  return getEstimationListSnapshot();
}

export function writeStoredEstimations(items: Estimation[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const raw = JSON.stringify(items);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedList = items.length > 0 ? items : EMPTY_LIST;
  window.dispatchEvent(new Event(ESTIMATION_LIST_EVENT));
}

/** Re-read storage and notify subscribers (no-op write). */
export function refreshEstimationList(): void {
  if (typeof window === "undefined") {
    return;
  }

  cachedRaw = null;
  cachedList = getEstimationListSnapshot();
  window.dispatchEvent(new Event(ESTIMATION_LIST_EVENT));
}

export function estimationKey(item: Estimation): string {
  return item.id || item.mine_id || "";
}

export function subscribeEstimationList(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(ESTIMATION_LIST_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(ESTIMATION_LIST_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
