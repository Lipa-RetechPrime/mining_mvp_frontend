import type { Estimation, PhaseTypeMaster } from "../types/estimation";
import {
  createInitialState,
  estimationReducer as pocEstimationReducer,
  type EstimationAction,
  type EstimationState,
} from "./estimationReducer";

export type { EstimationAction, EstimationState };

export const EMPTY_ESTIMATION: Estimation = {
  siteSubtitle: "Chuperbhita Simlong OCP",
  appendixLabel: "APPENDIX A 2.2",
  phaseLimit: null,
  electrificationPercentByEntity: {},
  percentageMasterIdByEntity: {},
  blocks: [],
};

export const initialState: EstimationState =
  createInitialState(EMPTY_ESTIMATION);

const KNOWN_ACTION_TYPES = new Set<EstimationAction["type"]>([
  "SET_ESTIMATION",
  "SET_ENTITIES",
  "SET_PHASE_TYPES",
  "ADD_BLOCK",
  "SET_ACTIVE_ENTITY",
  "UPDATE_STEP_FIELD",
  "UPDATE_STEP_FIELD_LABEL",
  "RECOMPUTE_STEP",
  "SET_STEP_AMOUNT_MODE",
  "SET_STEP_UNIT_COST_MODE",
  "ADD_STEP",
  "REMOVE_STEP",
  "SET_STEP_INDEX",
  "INIT_STEP_PHASES",
  "SET_MINE_PHASE_LIMIT",
  "SET_ELECTRIFICATION_PERCENT",
  "ADD_PHASE",
  "REMOVE_PHASE",
  "UPDATE_PHASE",
  "SET_PHASE_PAGE",
  "SET_ERRORS",
  "SET_STATUS",
]);

/** Store reducer: POC workspace logic for known actions; ignore Redux internals. */
export function estimationReducer(
  state: EstimationState | undefined = initialState,
  action: { type: string } & Record<string, unknown>,
): EstimationState {
  const current = state ?? initialState;
  if (!KNOWN_ACTION_TYPES.has(action.type as EstimationAction["type"])) {
    return current;
  }
  return pocEstimationReducer(current, action as EstimationAction);
}

export const setEstimation = (payload: Estimation) =>
  ({ type: "SET_ESTIMATION" as const, payload });

export const setPhaseTypes = (phaseTypes: PhaseTypeMaster[]) =>
  ({ type: "SET_PHASE_TYPES" as const, phaseTypes });

export const setStatus = (
  status: EstimationState["status"],
  message?: string,
) => ({ type: "SET_STATUS" as const, status, message });

export const setErrors = (errors: EstimationState["errors"]) =>
  ({ type: "SET_ERRORS" as const, errors });

export const resetEstimation = () =>
  ({ type: "SET_ESTIMATION" as const, payload: EMPTY_ESTIMATION });

type StateWithEstimation = { estimation: EstimationState };

export const selectEstimationWorkspace = (state: StateWithEstimation) =>
  state.estimation;

export const selectEstimation = (state: StateWithEstimation) =>
  state.estimation.estimation;

export const selectEstimationStatus = (state: StateWithEstimation) =>
  state.estimation.status;
