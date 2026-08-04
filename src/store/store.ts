import { configureStore } from "@reduxjs/toolkit";
import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit";

import { authReducer } from "@/features/auth/model/auth-slice";
import {
  estimationReducer,
  type EstimationAction,
} from "@/features/estimations/model/estimation-slice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      estimation: estimationReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;

/** Accept RTK actions and plain POC EstimationAction objects. */
export type AppDispatch = ThunkDispatch<
  RootState,
  undefined,
  UnknownAction | EstimationAction
>;
