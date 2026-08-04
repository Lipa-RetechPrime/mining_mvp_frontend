"use client";

import { useEffect } from "react";

import {
  useAppDispatch,
  useAppSelector,
} from "@/store/hooks";

import {
  hydrateAuth,
  selectAuth,
} from "../model/auth-slice";
import { readStoredSession } from "../model/auth-storage";

export function AuthBootstrap() {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector(selectAuth).hydrated;

  useEffect(() => {
    if (!hydrated) {
      dispatch(hydrateAuth(readStoredSession()));
    }
  }, [dispatch, hydrated]);

  return null;
}
