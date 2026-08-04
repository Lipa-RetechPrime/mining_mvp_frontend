"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "../hooks/use-auth";
import { useIsClient } from "../hooks/use-is-client";
import { buildLoginHref } from "../utils/return-path";
import { AuthStatusFallback } from "./AuthStatusFallback";

export interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Blocks protected routes until a client session exists.
 * Defers to a shared fallback until the client is ready so SSR HTML matches hydration.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hydrated, isAuthenticated } = useAuth();
  const isClient = useIsClient();

  useEffect(() => {
    if (!isClient || !hydrated || isAuthenticated) {
      return;
    }

    const search = searchParams.toString();
    const returnTo = search ? `${pathname}?${search}` : pathname;
    router.replace(buildLoginHref(returnTo));
  }, [isClient, hydrated, isAuthenticated, pathname, router, searchParams]);

  if (!isClient || !hydrated || !isAuthenticated) {
    return <AuthStatusFallback />;
  }

  return children;
}
