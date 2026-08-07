"use client";

import { useCallback, useEffect, useState } from "react";

import {
  deleteEstimation,
  getEstimation,
  invalidateEstimationsListCache,
  isStepPopulated,
  listEstimations,
  scopeEstimationToInvestmentType,
  withMinePhaseLimit,
} from "../api/investments";
import { useToast } from "../context/ToastContext";
import { useEstimationDispatch } from "./use-estimation";
import { createEmptyStep } from "../utils/factories";
import type { Estimation } from "../types/estimation";

/** Focus the requested entity tab; seed an empty cost-item row when the tab has no data. */
function withActiveEntity(estimation: Estimation, entityId?: string): Estimation {
  const preferredEntityId = (() => {
    if (!entityId) return undefined;
    const block = estimation.blocks[0];
    if (!block) return entityId;
    const requested =
      block.entityTabs.find((tab) => tab.entityId === entityId) ??
      block.entityTabs.find(
        (tab) =>
          tab.entityCode.trim().toLowerCase() === entityId.trim().toLowerCase(),
      );
    if (requested) {
      if (requested.steps.some(isStepPopulated)) return requested.entityId;
      // Still open the requested ECL/MDO tab even when empty (seed a row below).
      return requested.entityId;
    }
    const withData = block.entityTabs.find((tab) =>
      tab.steps.some(isStepPopulated),
    );
    return withData?.entityId ?? entityId;
  })();

  if (!preferredEntityId) return estimation;
  return {
    ...estimation,
    blocks: estimation.blocks.map((block, index) => {
      if (index !== 0) return block;
      const hasEntity = block.entityTabs.some(
        (tab) => tab.entityId === preferredEntityId,
      );
      if (!hasEntity) return block;
      return {
        ...block,
        activeEntityId: preferredEntityId,
        entityTabs: block.entityTabs.map((tab) => {
          if (tab.entityId !== preferredEntityId) return tab;
          if (tab.steps.some(isStepPopulated)) return tab;
          return {
            ...tab,
            steps: [createEmptyStep()],
            currentStepIndex: 0,
          };
        }),
      };
    }),
  };
}

function sameMine(a: Estimation, b: Estimation): boolean {
  return (
    (Boolean(a.id) && a.id === b.id) ||
    (Boolean(a.mine_id) && a.mine_id === b.mine_id)
  );
}

/** Prefer API phase_limit; if list omits it, keep a known local value for that mine. */
function mergePhaseLimitFromPrior(
  list: Estimation[],
  prior: Estimation[],
): Estimation[] {
  return list.map((item) => {
    if (item.phaseLimit != null) return item;
    const previous = prior.find((p) => sameMine(p, item));
    if (previous?.phaseLimit == null) return item;
    return withMinePhaseLimit(item, previous.phaseLimit);
  });
}

async function fetchEstimationList(): Promise<Estimation[]> {
  try {
    return await listEstimations();
  } catch {
    return [];
  }
}

export interface UseEstimationListValue {
  items: Estimation[];
  loading: boolean;
  refresh: () => Promise<Estimation[]>;
  replaceItem: (item: Estimation) => void;
  open: (
    id: string,
    entityId?: string,
    scope?: {
      functionInvestmentTypeId?: string | null;
      functionMasterId?: string | null;
      includeLegacyNullFit?: boolean;
      functionName?: string | null;
    },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useEstimationList(): UseEstimationListValue {
  const [items, setItems] = useState<Estimation[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const dispatch = useEstimationDispatch();
  const { success, error } = useToast();

  const refresh = useCallback(async () => {
    invalidateEstimationsListCache();
    const list = await fetchEstimationList();
    setItems((prev) => mergePhaseLimitFromPrior(list, prev));
    return list;
  }, []);

  const replaceItem = useCallback((estimation: Estimation) => {
    setItems((prev) => {
      const index = prev.findIndex((item) => sameMine(item, estimation));
      if (index < 0) return [...prev, estimation];
      const next = [...prev];
      const existing = next[index];
      // Saved responses are often scoped to one function — keep peer function blocks.
      const incomingFunctionIds = new Set(
        estimation.blocks.map((block) => block.sectorId).filter(Boolean),
      );
      const peerBlocks = existing.blocks.filter(
        (block) => block.sectorId && !incomingFunctionIds.has(block.sectorId),
      );
      const merged: Estimation = {
        ...existing,
        ...estimation,
        blocks: [...peerBlocks, ...estimation.blocks],
        electrificationPercentByEntity: {
          ...(existing.electrificationPercentByEntity ?? {}),
          ...(estimation.electrificationPercentByEntity ?? {}),
        },
        percentageMasterIdByEntity: {
          ...(existing.percentageMasterIdByEntity ?? {}),
          ...(estimation.percentageMasterIdByEntity ?? {}),
        },
      };
      next[index] =
        merged.phaseLimit == null && existing.phaseLimit != null
          ? withMinePhaseLimit(merged, existing.phaseLimit)
          : merged;
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const list = await fetchEstimationList();
        if (!cancelled) setItems(list);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const open = useCallback(
    async (
      id: string,
      entityId?: string,
      scope?: {
        functionInvestmentTypeId?: string | null
        functionMasterId?: string | null
        includeLegacyNullFit?: boolean
        functionName?: string | null
      },
    ) => {
      dispatch({ type: "SET_STATUS", status: "loading", message: "Loading…" })
      const fromList = items.find(
        (item) => item.id === id || item.mine_id === id,
      )
      let estimation = withActiveEntity(await getEstimation(id), entityId)
      if (estimation.phaseLimit == null && fromList?.phaseLimit != null) {
        estimation = withMinePhaseLimit(estimation, fromList.phaseLimit)
      }
      if (scope?.functionInvestmentTypeId || scope?.functionMasterId) {
        estimation = scopeEstimationToInvestmentType(
          estimation,
          scope.functionInvestmentTypeId,
          scope.functionMasterId,
          {
            includeLegacyNullFit: scope.includeLegacyNullFit,
            functionName: scope.functionName,
          },
        )
      }
      dispatch({ type: "SET_ESTIMATION", payload: estimation })
      dispatch({ type: "SET_STATUS", status: "idle", message: "" })
    },
    [dispatch, items],
  )


  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteEstimation(id);
        await refresh();
        success("Mine deleted successfully");
      } catch (err) {
        error(err instanceof Error ? err.message : "Failed to delete mine");
        throw err;
      }
    },
    [refresh, success, error],
  );

  return {
    items,
    loading: initialLoading,
    refresh,
    replaceItem,
    open,
    remove,
  };
}
