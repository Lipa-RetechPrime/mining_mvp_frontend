import Link from "next/link";

import { routes } from "@/shared/config/routes";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
          Page not found
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          The page you requested does not exist.
        </p>
        <Link
          href={routes.home}
          className="mt-6 inline-flex rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-50 dark:text-zinc-950"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
