"use client";

import {
  computeAmount,
  computeAutomaticValue,
} from "../calculations/calculations";
import { createEstimation, updateEstimation } from "../api/investments";
import { useToast } from "../context/ToastContext";
import { isValid, validateEstimation } from "../utils/validation";
import type { Estimation } from "../types/estimation";
import type { PhaseValidationMode } from "../utils/validation";
import {
  useEstimationDispatch,
  useEstimationState,
} from "./use-estimation";

function recomputeAll(estimation: Estimation): Estimation {
  return {
    ...estimation,
    blocks: estimation.blocks.map((block) => ({
      ...block,
      entityTabs: block.entityTabs.map((tab) => ({
        ...tab,
        steps: tab.steps.map((step) => {
          const amount =
            step.amountMode === "manual"
              ? step.amount
              : computeAmount(
                  step.qrts,
                  step.unitCostMode === "on_hire" ? 0 : step.unitCost,
                );
          return {
            ...step,
            unitCost: step.unitCostMode === "on_hire" ? 0 : step.unitCost,
            amount,
            phases: step.phases.map((phase) => {
              if (
                phase.calculationMode === "automatic" &&
                phase.percentage !== null
              ) {
                return {
                  ...phase,
                  value:
                    amount === null
                      ? null
                      : computeAutomaticValue(amount, phase.percentage),
                };
              }
              return phase;
            }),
          };
        }),
      })),
    })),
  };
}

export interface UseSubmitEstimationValue {
  submit: () => Promise<Estimation | void>;
  submitting: boolean;
}

export function useSubmitEstimation(options?: {
  phaseValidationMode?: PhaseValidationMode;
  /** Partial: required so payback-room validation can block submit. */
  paybackPeriodYears?: number | null;
  /** @deprecated Prefer phaseValidationMode: 'full' */
  skipPhaseAmountValidation?: boolean;
}): UseSubmitEstimationValue {
  const { estimation, status } = useEstimationState();
  const dispatch = useEstimationDispatch();
  const { success, error } = useToast();
  const phaseValidationMode: PhaseValidationMode =
    options?.phaseValidationMode ??
    (options?.skipPhaseAmountValidation ? "full" : "strict");

  async function submit() {
    const prepared = recomputeAll(estimation);
    const errors = validateEstimation(prepared, {
      phaseValidationMode,
      paybackPeriodYears: options?.paybackPeriodYears,
    });
    dispatch({ type: "SET_ERRORS", errors });
    if (!isValid(errors)) {
      const sumMessages = Object.entries(errors)
        .filter(
          ([key]) =>
            key.endsWith(".phaseAmountSum") ||
            key === "phaseAmountSum" ||
            key.endsWith(".paybackRoom"),
        )
        .map(([, message]) => message);
      const percentMessages = Object.entries(errors)
        .filter(([key]) => key.startsWith("electrificationPercent."))
        .map(([, message]) => message);
      const messages = [...percentMessages, ...sumMessages];
      if (messages.length > 0) {
        dispatch({
          type: "SET_STATUS",
          status: "error",
          message: messages.join("\n"),
        });
      }
      return;
    }
    dispatch({ type: "SET_STATUS", status: "saving", message: "" });
    const isCreate = !prepared.mine_id && !prepared.id;
    try {
      const saved = isCreate
        ? await createEstimation(prepared)
        : await updateEstimation(prepared.mine_id || prepared.id!, prepared, {
            phaseValidationMode,
            paybackPeriodYears: options?.paybackPeriodYears,
            skipPhaseAmountValidation:
              phaseValidationMode === "full" ||
              phaseValidationMode === "adhoc",
          });
      // Keep peer cost-function blocks in memory (save responses are scoped).
      const savedFunctionIds = new Set(
        saved.blocks.map((block) => block.sectorId).filter(Boolean),
      );
      const peerBlocks = prepared.blocks.filter(
        (block) => block.sectorId && !savedFunctionIds.has(block.sectorId),
      );
      const merged: Estimation = {
        ...prepared,
        ...saved,
        blocks: [...peerBlocks, ...saved.blocks],
        electrificationPercentByEntity: {
          ...(prepared.electrificationPercentByEntity ?? {}),
          ...(saved.electrificationPercentByEntity ?? {}),
        },
        percentageMasterIdByEntity: {
          ...(prepared.percentageMasterIdByEntity ?? {}),
          ...(saved.percentageMasterIdByEntity ?? {}),
        },
      };
      dispatch({ type: "SET_ESTIMATION", payload: merged });
      dispatch({
        type: "SET_STATUS",
        status: "saved",
        message: `Saved ${saved.id}`,
      });
      if (isCreate) {
        success("Mine created successfully");
      } else {
        success("Mine updated successfully");
      }
      return merged;
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : isCreate
            ? "Failed to create mine"
            : "Failed to update mine";
      dispatch({ type: "SET_STATUS", status: "error", message });
      error(message);
    }
  }

  return { submit, submitting: status === "saving" };
}
