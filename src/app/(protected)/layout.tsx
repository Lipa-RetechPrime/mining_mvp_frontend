import { Suspense } from "react";

import { AuthStatusFallback } from "@/features/auth/components/AuthStatusFallback";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { AppShell } from "@/shared/components/layout/AppShell";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<AuthStatusFallback />}>
      <RequireAuth>
        <AppShell>{children}</AppShell>
      </RequireAuth>
    </Suspense>
  );
}
