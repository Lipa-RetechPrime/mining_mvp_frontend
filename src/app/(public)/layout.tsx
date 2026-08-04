import { Suspense } from "react";

import { GuestOnly } from "@/features/auth/components/GuestOnly";
import { AuthStatusFallback } from "@/features/auth/components/AuthStatusFallback";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<AuthStatusFallback />}>
      <GuestOnly>{children}</GuestOnly>
    </Suspense>
  );
}
