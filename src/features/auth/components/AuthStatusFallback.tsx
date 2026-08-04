import { MaterialIcon } from "@/shared/components/ui";
import type { ReactNode } from "react";

export function AuthStatusFallback({
  message = <MaterialIcon name="loop" className="animate-spin text-[--color-portal-purple]" size={36} />,
}: {
  message?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1F6FF]">
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
