"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";

import { makeStore, type AppStore } from "./store";

export interface StoreProviderProps {
  children: ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  const [store] = useState<AppStore>(makeStore);

  return <Provider store={store}>{children}</Provider>;
}
