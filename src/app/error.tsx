"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error", error.digest ?? "unknown");
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Something went wrong
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          The page could not be displayed. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-950"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
