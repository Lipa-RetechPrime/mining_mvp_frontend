"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { routes } from "@/shared/config/routes";

import { useAuth } from "../hooks/use-auth";
import { useIsClient } from "../hooks/use-is-client";
import { AuthStatusFallback } from "./AuthStatusFallback";

export interface GuestOnlyProps {
  children: ReactNode;
}

/**
 * Keeps authenticated users off guest routes such as login.
 * Defers to a shared fallback until the client is ready so SSR HTML matches hydration.
 */
export function GuestOnly({ children }: GuestOnlyProps) {
  const router = useRouter();
  const { hydrated, isAuthenticated } = useAuth();
  const isClient = useIsClient();

  useEffect(() => {
    if (!isClient || !hydrated || !isAuthenticated) {
      return;
    }

    router.replace(routes.dashboard);
  }, [isClient, hydrated, isAuthenticated, router]);

  if (!isClient || !hydrated) {
    return <AuthStatusFallback />;
  }

  if (isAuthenticated) {
    return <AuthStatusFallback />;
  }

  return children;
}
