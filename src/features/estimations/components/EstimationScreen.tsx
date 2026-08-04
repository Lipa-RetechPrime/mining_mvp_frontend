"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/shared/components/ui/Button";
import { MaterialIcon } from "@/shared/components/ui/MaterialIcon";
import { Modal } from "@/shared/components/ui/Modal";

import { getEntities, SECTOR_CATALOG } from "../api/master";
import {
  useEstimationDispatch,
  useEstimationState,
} from "../hooks/use-estimation";
import { useEstimationList } from "../hooks/useLoadEstimation";
import { useSubmitEstimation } from "../hooks/useSubmitEstimation";
import { EMPTY_ESTIMATION } from "../model/estimation-slice";
import type { PhaseTypeMaster } from "../types/estimation";
import { createEmptyEstimation } from "../utils/factories";
import { CostItemsTable } from "./CostItemsTable";
import { EmptyEstimationState } from "./EmptyEstimationState";
import { EstimationBlockView } from "./EstimationBlockView";

const DEFAULT_SECTOR = SECTOR_CATALOG[0] ?? {
  id: "residential-buildings",
  name: "Residential buildings",
};

type PageMode = "form" | "table";

export interface EstimationScreenProps {
  phaseTypes: PhaseTypeMaster[];
  mineId?: string;
  /** When URL mine ids are placeholders, match the API list by mine name. */
  mineName?: string;
}

/**
 * Cost-estimation workspace.
 * Mode is derived from list length; modeOverride covers user-driven form/table switches
 * without setState-in-effect loops.
 * Active sector comes from `?sector=` (MineSideNav).
 */
export function EstimationScreen({
  phaseTypes,
  mineId,
  mineName,
}: EstimationScreenProps) {
  const searchParams = useSearchParams();
  const { estimation, status, statusMessage } = useEstimationState();
  const dispatch = useEstimationDispatch();
  const { submit, submitting } = useSubmitEstimation();
  const { items, loading, refresh, replaceItem, open, remove } =
    useEstimationList();

  const [modeOverride, setModeOverride] = useState<PageMode | null>(null);
  const openedMineIdRef = useRef<string | null>(null);

  const activeSectorId = searchParams.get("sector") || DEFAULT_SECTOR.id;
  const activeSector =
    SECTOR_CATALOG.find((sector) => sector.id === activeSectorId) ??
    DEFAULT_SECTOR;

  useEffect(() => {
    dispatch({ type: "SET_PHASE_TYPES", phaseTypes });
  }, [dispatch, phaseTypes]);

  useEffect(() => {
    if (loading) return;
    const openKey = mineId || mineName || null;
    if (!openKey) return;
    if (openedMineIdRef.current === openKey) return;
    const nameKey = (mineName || "").trim().toLowerCase();
    const match =
      items.find((item) => item.id === mineId || item.mine_id === mineId) ??
      (nameKey
        ? items.find(
            (item) => (item.siteSubtitle || "").trim().toLowerCase() === nameKey,
          )
        : undefined);
    if (!match) return;
    openedMineIdRef.current = openKey;
    void open(match.id || match.mine_id || mineId || openKey);
  }, [mineId, mineName, items, loading, open]);

  const pageMode: PageMode =
    modeOverride ?? (items.length > 0 ? "table" : "form");

  // Ensure a block exists for the nav-selected sector while editing the form.
  useEffect(() => {
    if (pageMode !== "form") return;
    if (estimation.blocks.some((block) => block.sectorId === activeSector.id)) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const entities = await getEntities(activeSector.id);
      if (cancelled) return;
      dispatch({
        type: "SET_ENTITIES",
        sectorId: activeSector.id,
        entities,
      });
      dispatch({
        type: "ADD_BLOCK",
        sectorId: activeSector.id,
        sectorName: activeSector.name,
        entities,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeSector.id,
    activeSector.name,
    dispatch,
    estimation.blocks,
    pageMode,
  ]);

  async function startNewEstimation() {
    const entities = await getEntities(activeSector.id);
    dispatch({
      type: "SET_ESTIMATION",
      payload: createEmptyEstimation(
        activeSector.id,
        activeSector.name,
        entities,
      ),
    });
    setModeOverride("form");
  }

  async function handleAddEstimation() {
    if (items.length > 0) {
      setModeOverride("table");
      return;
    }
    await startNewEstimation();
  }

  async function handleEdit(id: string, entityId?: string) {
    await open(id, entityId);
    setModeOverride("form");
  }

  function handleCancel() {
    setModeOverride("table");
  }

  async function handleSubmit() {
    const saved = await submit();
    if (!saved) return;
    replaceItem(saved);
    await refresh();
    setModeOverride("table");
  }

  async function handleDelete(id: string) {
    await remove(id);
    if (items.length <= 1) {
      dispatch({ type: "SET_ESTIMATION", payload: EMPTY_ESTIMATION });
      setModeOverride(null);
    }
  }

  const sectorBlocks = estimation.blocks.filter(
    (block) => block.sectorId === activeSector.id,
  );
  const lastBlockId = sectorBlocks[sectorBlocks.length - 1]?.id;
  const isEditing = Boolean(estimation.id);
  const showCancel = pageMode === "form" && items.length > 0;
  const isWorkingOnForm = pageMode === "form" && estimation.blocks.length > 0;
  const showEmptyState = !loading && items.length === 0 && !isWorkingOnForm;

  return (
    <>
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
          onEdit={(id, entityId) => void handleEdit(id, entityId)}
          onDelete={(id) => void handleDelete(id)}
          onChanged={async () => {
            await refresh();
          }}
          onItemUpdated={replaceItem}
        />
      ) : (
        sectorBlocks.map((block) => (
          <EstimationBlockView
            key={block.id}
            block={block}
            appendixLabel={estimation.appendixLabel}
            siteSubtitle={estimation.siteSubtitle}
            showSubmit={block.id === lastBlockId}
            submitting={submitting}
            isEditing={isEditing}
            onSubmit={() => void handleSubmit()}
            onCancel={showCancel ? handleCancel : undefined}
          />
        ))
      )}
    </>
  );
}
