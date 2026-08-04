import { MaterialIcon } from "@/shared/components/ui";

export default function Loading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        <MaterialIcon name="loading_2" className="animate-spin" />
      </p>
    </main>
  );
}
