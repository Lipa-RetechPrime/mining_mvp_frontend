"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/shared/components/ui/Button";
import { MaterialIcon } from "@/shared/components/ui/MaterialIcon";
import { Modal } from "@/shared/components/ui/Modal";

import {
  getEntities,
  getMineWiseFunctionList,
  type MineFunction,
} from "../api/master";
import {
  useEstimationDispatch,
  useEstimationState,
} from "../hooks/use-estimation";
import { useEstimationList } from "../hooks/useLoadEstimation";
import { useSubmitEstimation } from "../hooks/useSubmitEstimation";
import { EMPTY_ESTIMATION } from "../model/estimation-slice";
import type { PhaseTypeMaster, Sector } from "../types/estimation";
import { createEmptyEstimation } from "../utils/factories";
import { CostItemsTable } from "./CostItemsTable";
import { EmptyEstimationState } from "./EmptyEstimationState";
import { EstimationBlockView } from "./EstimationBlockView";
import {
  isAdhocOutsourcing,
  isFullOutsourcing,
  isPartialOutsourcing,
  OutsourcingPartialProvider,
  type OutsourcingContributionSettings,
} from "@/features/projects/OutsourcingPartialContext";
import { OutsourcingConfigBanner } from "@/features/projects/OutsourcingConfigBanner";
import {
  isStepPopulated,
  scopeEstimationToInvestmentType,
} from "@/features/estimations/api/investments";

const DEFAULT_SECTOR: Sector = {
  id: "",
  name: "",
};

type PageMode = "form" | "table";

export interface EstimationScreenProps {
  phaseTypes: PhaseTypeMaster[];
  mineId?: string;
  /** When URL mine ids are placeholders, match the API list by mine name. */
  mineName?: string;
  /**
   * Active OW / PO / FO / AH FunctionInvestmentType id. Cost items and phases are
   * isolated per type so ownership and outsourcing never share phase data.
   */
  functionInvestmentTypeId?: string | null;
  /** When set, phase cards / overall sheet use outsourcing rules. */
  outsourcingPartial?: OutsourcingContributionSettings | null;
  onEditOutsourcingConfig?: () => void;
  /** Fires when the form has local edits that would be lost on delivery-mode switch. */
  onUnsavedChangesChange?: (dirty: boolean) => void;
}

/**
 * Cost-estimation workspace.
 * Per cost function: empty function → create form; function with items → table.
 * Active function comes from `?sector=` (MineSideNav).
 */
export function EstimationScreen({
  phaseTypes,
  mineId,
  mineName,
  functionInvestmentTypeId = null,
  outsourcingPartial = null,
  onEditOutsourcingConfig,
  onUnsavedChangesChange,
}: EstimationScreenProps) {
  const searchParams = useSearchParams();
  const { estimation, status, statusMessage, dirty } = useEstimationState();
  const dispatch = useEstimationDispatch();
  const { submit, submitting } = useSubmitEstimation({
    phaseValidationMode: isFullOutsourcing(outsourcingPartial)
      ? "full"
      : isAdhocOutsourcing(outsourcingPartial)
        ? "adhoc"
        : isPartialOutsourcing(outsourcingPartial)
          ? "partial"
          : "strict",
    paybackPeriodYears: isPartialOutsourcing(outsourcingPartial)
      ? outsourcingPartial.paybackPeriodYears
      : null,
  });
  const { items, loading, refresh, replaceItem, open, remove } =
    useEstimationList();

  const [modeOverride, setModeOverride] = useState<PageMode | null>(null);
  /** True only after user opens Edit — shows Update. First-time create keeps Submit. */
  const [editingExisting, setEditingExisting] = useState(false);
  const openedMineIdRef = useRef<string | null>(null);
  const seededEmptyFunctionRef = useRef<string | null>(null);
  const [mineFunctions, setMineFunctions] = useState<MineFunction[]>([]);
  const [functionsReady, setFunctionsReady] = useState(false);

  const activeSectorId = searchParams.get("sector") || DEFAULT_SECTOR.id;
  const activeSector: Sector = useMemo(() => {
    const fromApi = mineFunctions.find(
      (fn) => fn.function_master_id === activeSectorId,
    );
    if (fromApi) {
      return {
        id: fromApi.function_master_id,
        name: fromApi.function_name,
      };
    }
    // Prefer a known block name over a generic placeholder while the list resolves.
    const fromBlock = estimation.blocks.find(
      (block) => block.sectorId === activeSectorId,
    );
    const blockName = fromBlock?.sectorName?.trim() || "";
    if (
      activeSectorId &&
      blockName &&
      blockName.toLowerCase() !== "cost function"
    ) {
      return { id: activeSectorId, name: blockName };
    }
    return activeSectorId
      ? { id: activeSectorId, name: "" }
      : DEFAULT_SECTOR;
  }, [mineFunctions, activeSectorId, estimation.blocks]);

  async function reloadMineFunctions() {
    if (!mineId?.trim()) {
      setMineFunctions([]);
      setFunctionsReady(true);
      return;
    }
    try {
      const list = await getMineWiseFunctionList(mineId);
      setMineFunctions(list);
    } catch {
      setMineFunctions([]);
    } finally {
      setFunctionsReady(true);
    }
  }

  useEffect(() => {
    setFunctionsReady(false);
    void reloadMineFunctions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when mine changes
  }, [mineId]);

  useEffect(() => {
    dispatch({ type: "SET_PHASE_TYPES", phaseTypes });
  }, [dispatch, phaseTypes]);

  useEffect(() => {
    onUnsavedChangesChange?.(Boolean(dirty && status !== "saving"));
  }, [dirty, status, onUnsavedChangesChange]);

  useEffect(() => {
    if (loading) return
    // Wait for FIT so we don't open an empty scoped sheet and wipe the view.
    if (!functionInvestmentTypeId) return
    const openKey = [
      mineId || mineName || "",
      functionInvestmentTypeId,
      activeSectorId || "",
    ].join(":")
    if (!mineId && !mineName) return
    if (openedMineIdRef.current === openKey) return
    const nameKey = (mineName || "").trim().toLowerCase()
    const match =
      items.find((item) => item.id === mineId || item.mine_id === mineId) ??
      (nameKey
        ? items.find(
            (item) => (item.siteSubtitle || "").trim().toLowerCase() === nameKey,
          )
        : undefined)
    if (!match) return
    openedMineIdRef.current = openKey
    void open(match.id || match.mine_id || mineId || openKey, undefined, {
      functionInvestmentTypeId,
      functionMasterId: activeSectorId || null,
      includeLegacyNullFit: !outsourcingPartial,
      functionName: activeSector.name || null,
    })
  }, [
    mineId,
    mineName,
    items,
    loading,
    open,
    functionInvestmentTypeId,
    activeSectorId,
    activeSector.name,
    outsourcingPartial,
  ])

  // Switching Cost Function or FIT recalculates form vs table.
  useEffect(() => {
    setModeOverride(null);
    setEditingExisting(false);
    seededEmptyFunctionRef.current = null;
    openedMineIdRef.current = null;
  }, [activeSectorId, functionInvestmentTypeId]);

  // Persist “has items” for the active function + FIT on this mine only.
  const activeFunctionHasItems = useMemo(() => {
    if (!activeSectorId || !functionInvestmentTypeId) return false
    const nameKey = (mineName || '').trim().toLowerCase()
    const mineItem =
      items.find((item) => item.id === mineId || item.mine_id === mineId) ??
      (nameKey
        ? items.find(
            (item) =>
              (item.siteSubtitle || '').trim().toLowerCase() === nameKey,
          )
        : undefined)
    if (!mineItem) return false
    const scoped = scopeEstimationToInvestmentType(
      mineItem,
      functionInvestmentTypeId,
      activeSectorId,
      {
        includeLegacyNullFit: !outsourcingPartial,
        functionName: activeSector.name || null,
      },
    )
    return scoped.blocks.some((block) =>
      block.entityTabs.some((tab) => tab.steps.some(isStepPopulated)),
    )
  }, [
    items,
    mineId,
    mineName,
    activeSectorId,
    activeSector.name,
    functionInvestmentTypeId,
    outsourcingPartial,
  ])

  // Drop in-memory estimation when navigating to a different mine.
  useEffect(() => {
    if (!mineId?.trim()) return
    const currentMine = estimation.mine_id || estimation.id
    if (currentMine && currentMine !== mineId) {
      dispatch({ type: 'SET_ESTIMATION', payload: EMPTY_ESTIMATION })
      openedMineIdRef.current = null
      seededEmptyFunctionRef.current = null
      setModeOverride(null)
      setEditingExisting(false)
    }
  }, [mineId, estimation.mine_id, estimation.id, dispatch])

  const pageMode: PageMode =
    modeOverride ??
    (activeSectorId && functionsReady
      ? activeFunctionHasItems
        ? "table"
        : "form"
      : items.length > 0
        ? "table"
        : "form");

  const sectorBlocks = estimation.blocks.filter(
    (block) => block.sectorId === activeSector.id,
  );
  const hasActiveBlock = sectorBlocks.length > 0;
  const activeBlockNameMismatch = sectorBlocks.some(
    (block) =>
      Boolean(activeSector.name) && block.sectorName !== activeSector.name,
  );

  const activeSectorIdRef = useRef(activeSectorId);
  activeSectorIdRef.current = activeSectorId;
  const estimationRef = useRef(estimation);
  estimationRef.current = estimation;

  // Empty cost function → ensure a create block exists for the active sector.
  // Preserve other functions’ blocks already in memory (do not wipe the mine).
  useEffect(() => {
    if (pageMode !== "form") return;
    if (!activeSector.id || loading) return;
    if (activeFunctionHasItems) return;
    if (hasActiveBlock && !activeBlockNameMismatch) {
      seededEmptyFunctionRef.current = `${activeSector.id}:${functionInvestmentTypeId ?? ""}`;
      return;
    }

    const sectorId = activeSector.id;
    const sectorName = activeSector.name;
    const seedKey = `${sectorId}:${functionInvestmentTypeId ?? ""}`;
    if (seededEmptyFunctionRef.current === seedKey) return;

    const current = estimationRef.current;
    const existingMineId = current.mine_id || mineId || undefined;
    const siteSubtitle = mineName || current.siteSubtitle || ''
    const appendixLabel = current.appendixLabel || "APPENDIX A 2.2";
    const phaseLimit = current.phaseLimit ?? null;

    void (async () => {
      const entities = await getEntities(sectorId);
      // Ignore stale async work after the user switched Cost Function.
      if (sectorId !== activeSectorIdRef.current) return;

      dispatch({
        type: "SET_ENTITIES",
        sectorId,
        entities,
      });

      const emptyBlock = createEmptyEstimation(sectorId, sectorName, entities)
        .blocks[0];
      const latest = estimationRef.current;
      const peerBlocks = latest.blocks.filter(
        (block) => block.sectorId !== sectorId,
      );

      dispatch({
        type: "SET_ESTIMATION",
        payload: {
          ...latest,
          ...(existingMineId
            ? { id: existingMineId, mine_id: existingMineId }
            : {}),
          functionInvestmentTypeId,
          siteSubtitle,
          appendixLabel,
          phaseLimit,
          blocks: [...peerBlocks, emptyBlock],
        },
      });
      seededEmptyFunctionRef.current = seedKey;
    })();
  }, [
    pageMode,
    activeSector.id,
    activeSector.name,
    activeFunctionHasItems,
    hasActiveBlock,
    activeBlockNameMismatch,
    loading,
    dispatch,
    mineId,
    mineName,
    functionInvestmentTypeId,
  ]);

  async function startNewEstimation() {
    const entities = await getEntities(activeSector.id);
    dispatch({
      type: "SET_ESTIMATION",
      payload: {
        ...createEmptyEstimation(
          activeSector.id,
          activeSector.name,
          entities,
        ),
        ...(mineId ? { id: mineId, mine_id: mineId } : {}),
        siteSubtitle: mineName || estimation.siteSubtitle || '',
      },
    });
    seededEmptyFunctionRef.current = activeSector.id;
    setEditingExisting(false);
    setModeOverride("form");
  }

  async function handleAddEstimation() {
    if (activeFunctionHasItems) {
      setModeOverride("table");
      return;
    }
    await startNewEstimation();
  }

  async function handleEdit(id: string, entityId?: string) {
    await open(id, entityId, {
      functionInvestmentTypeId,
      functionMasterId: activeSectorId || null,
      includeLegacyNullFit: !outsourcingPartial,
      functionName: activeSector.name || null,
    })
    setEditingExisting(true)
    setModeOverride("form")
  }

  function handleCancel() {
    setEditingExisting(false);
    setModeOverride("table");
  }

  async function handleSubmit() {
    const saved = await submit();
    if (!saved) return;
    await refresh();
    await reloadMineFunctions();
    seededEmptyFunctionRef.current = null;
    setEditingExisting(false);
    setModeOverride("table");
  }

  async function handleDelete(id: string) {
    await remove(id);
    await reloadMineFunctions();
    if (items.length <= 1) {
      dispatch({ type: "SET_ESTIMATION", payload: EMPTY_ESTIMATION });
      setEditingExisting(false);
      setModeOverride(null);
    }
  }

  const lastBlockId = sectorBlocks[sectorBlocks.length - 1]?.id;
  // Submit: first-time create (single/multiple new cost items).
  // Update: only when returning via Edit after overall/table exists.
  const isEditing = editingExisting;
  const showCancel =
    pageMode === "form" && (items.length > 0 || activeFunctionHasItems);
  const isWorkingOnForm = pageMode === "form" && sectorBlocks.length > 0;
  const showEmptyState =
    !loading &&
    functionsReady &&
    !activeSectorId &&
    items.length === 0 &&
    !isWorkingOnForm;

  return (
    <OutsourcingPartialProvider value={outsourcingPartial}>
      {outsourcingPartial && onEditOutsourcingConfig ? (
        <OutsourcingConfigBanner
          settings={outsourcingPartial}
          onEdit={onEditOutsourcingConfig}
        />
      ) : null}
      {loading && pageMode !== "form" ? (
        <div className="flex flex-col items-center justify-center py-32">
          <svg
            className="h-10 w-10 animate-spin text-portal-purple"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="mt-4 text-sm text-gray-500">Loading estimations…</p>
        </div>
      ) : null}
      {status === "error" && statusMessage ? (
        <Modal
          open
          title={
            statusMessage.toLowerCase().includes("phase values must sum")
              ? "Phase amount mismatch"
              : "Unable to submit estimation"
          }
          onClose={() =>
            dispatch({ type: "SET_STATUS", status: "idle", message: "" })
          }
          backdropClassName="bg-black/30 backdrop-blur-sm"
          className="max-w-md"
          footer={
            <Button
              variant="primary"
              onClick={() =>
                dispatch({ type: "SET_STATUS", status: "idle", message: "" })
              }
            >
              OK
            </Button>
          }
        >
          <div
            className="flex items-start gap-3 text-sm text-portal-navy"
            role="alert"
          >
            <MaterialIcon
              name="warning"
              size={24}
              className="shrink-0 text-amber-500"
            />
            <p className="whitespace-pre-wrap">{statusMessage}</p>
          </div>
        </Modal>
      ) : null}
      {loading && pageMode !== "form" ? null : showEmptyState ? (
        <EmptyEstimationState onAdd={() => void handleAddEstimation()} />
      ) : pageMode === "table" ? (
        <CostItemsTable
          items={items}
          phaseTypes={phaseTypes}
          mineId={mineId}
          mineName={mineName}
          functionMasterId={activeSectorId || null}
          functionName={activeSector.name || null}
          functionInvestmentTypeId={functionInvestmentTypeId}
          includeLegacyNullFit={!outsourcingPartial}
          onEdit={(id, entityId) => void handleEdit(id, entityId)}
          onDelete={(id) => void handleDelete(id)}
          onChanged={async () => {
            await refresh();
            await reloadMineFunctions();
          }}
          onItemUpdated={replaceItem}
        />
      ) : sectorBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-sm text-gray-500">
          Preparing cost item form…
        </div>
      ) : (
        sectorBlocks.map((block) => (
          <EstimationBlockView
            key={block.id}
            block={block}
            appendixLabel={estimation.appendixLabel}
            siteSubtitle={estimation.siteSubtitle}
            sectorDisplayName={activeSector.name || null}
            showSubmit={block.id === lastBlockId}
            submitting={submitting}
            isEditing={isEditing}
            onSubmit={() => void handleSubmit()}
            onCancel={showCancel ? handleCancel : undefined}
          />
        ))
      )}
    </OutsourcingPartialProvider>
  );
}
