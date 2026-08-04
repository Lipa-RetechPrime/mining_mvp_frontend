"use client";

import { useCallback } from "react";

import {
  useAppDispatch,
  useAppSelector,
} from "@/store/hooks";

import {
  clearAuthError,
  login as loginAction,
  logout as logoutAction,
  selectAuth,
  selectIsAuthenticated,
} from "../model/auth-slice";
import type { AuthStatus, AuthUser } from "../types";

export interface UseAuthValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  status: AuthStatus;
  error: string | null;
  hydrated: boolean;
  login: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export function useAuth(): UseAuthValue {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const isAuthenticated = useAppSelector(
    selectIsAuthenticated,
  );

  const login = useCallback(
    async (
      email: string,
      password: string,
      displayName?: string,
    ) => {
      await dispatch(
        loginAction({ email, password, displayName }),
      ).unwrap();
    },
    [dispatch],
  );

  const logout = useCallback(() => {
    void dispatch(logoutAction());
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  return {
    user: auth.user,
    token: auth.token,
    isAuthenticated,
    status: auth.status,
    error: auth.error,
    hydrated: auth.hydrated,
    login,
    logout,
    clearError,
  };
}
