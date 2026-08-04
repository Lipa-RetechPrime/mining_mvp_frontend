"use client";

/** Temporary no-op toast shim until a shared toast provider is wired. */
export function useToast() {
  const noop = (() => undefined) as (message?: string) => void;
  return {
    success: noop,
    error: noop,
    info: noop,
  };
}
