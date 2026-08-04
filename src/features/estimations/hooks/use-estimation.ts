"use client";

import {
  useAppDispatch,
  useAppSelector,
} from "@/store/hooks";

import { selectEstimationWorkspace } from "../model/estimation-slice";
import type { EstimationWorkspaceState } from "../types/estimation";

export function useEstimationState(): EstimationWorkspaceState {
  return useAppSelector(selectEstimationWorkspace);
}

export function useEstimationDispatch() {
  return useAppDispatch();
}
