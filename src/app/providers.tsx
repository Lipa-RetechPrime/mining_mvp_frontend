"use client";

import type { ReactNode } from "react";

import { AuthBootstrap } from "@/features/auth/components/AuthBootstrap";
import { StoreProvider } from "@/store/provider";

export interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <StoreProvider>
      <AuthBootstrap />
      {children}
    </StoreProvider>
  );
}
