"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { EstimationScreen } from "@/features/estimations";
import { getPhaseTypes } from "@/features/estimations/api/master";
import {
  DeliveryModeModal,
  OutsourcingPlaceholder,
  getStoredDeliveryMode,
  setStoredDeliveryMode,
  type DeliveryModeCode,
} from "@/features/projects";
import { Button } from "@/shared/components/ui/Button";
import { MaterialIcon } from "@/shared/components/ui/MaterialIcon";
import { routes } from "@/shared/config/routes";
import type { Estimation, PhaseTypeMaster } from "@/shared/types";
import {
  formatLastUpdated,
  sortMinesByLastUpdated,
} from "@/shared/utils/mineList";

const PROJECT_WITH_DETAILS = "Chuperbhita Simlong OCP";

function mineKey(mine: Estimation): string {
  return mine.mine_id || mine.id || "";
}

function hasProjectDetails(mine: Estimation | undefined): boolean {
  if (!mine) {
    return false;
  }

  return (
    (mine.siteSubtitle || "").trim().toLowerCase() ===
    PROJECT_WITH_DETAILS.toLowerCase()
  );
}

const listOfProjects = [
  {
    mine_id: "1",
    siteSubtitle: "Chuperbhita Simlong OCP",
    lifeOfMine: "25 years",
    updatedAt: "2026-07-27T10:00:00.000Z",
  },
  {
    mine_id: "2",
    siteSubtitle: "Project 2",
    lifeOfMine: "18 years",
    updatedAt: "2026-07-20T08:00:00.000Z",
  },
  {
    mine_id: "3",
    siteSubtitle: "Project 3",
    lifeOfMine: "30 years",
    updatedAt: "2026-07-25T14:30:00.000Z",
  },
  {
    mine_id: "4",
    siteSubtitle: "Project 4",
    lifeOfMine: "12 years",
    updatedAt: "2026-06-15T09:00:00.000Z",
  },
  {
    mine_id: "5",
    siteSubtitle: "Project 5",
    lifeOfMine: "22 years",
    updatedAt: "2026-07-26T18:00:00.000Z",
  },
  {
    mine_id: "6",
    siteSubtitle: "Project 6",
    lifeOfMine: "15 years",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
];

const EMPTY_PHASE_TYPES: PhaseTypeMaster[] = [];

export default function ProjectDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const projectIdRaw = Array.isArray(params?.projectId)
    ? params.projectId[0]
    : params?.projectId;
  const decodedId = projectIdRaw ? decodeURIComponent(projectIdRaw) : "";

  const [mines] = useState(() => listOfProjects as Estimation[]);
  const [phaseTypes, setPhaseTypes] =
    useState<PhaseTypeMaster[]>(EMPTY_PHASE_TYPES);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryModeCode | null>(
    null,
  );
  const [modeReady, setModeReady] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const types = await getPhaseTypes();
        if (!cancelled) setPhaseTypes(types);
      } catch {
        if (!cancelled) setPhaseTypes(EMPTY_PHASE_TYPES);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!decodedId) {
      setDeliveryMode(null);
      setModeReady(true);
      setShowModeModal(false);
      return;
    }
    const stored = getStoredDeliveryMode(decodedId);
    setDeliveryMode(stored);
    setModeReady(true);
    setShowModeModal(!stored);
  }, [decodedId]);

  const mineOptions = useMemo(
    () => sortMinesByLastUpdated(mines),
    [mines],
  );

  const selectedMine = mineOptions.find(
    (mine) => mineKey(mine) === decodedId,
  );
  const selectedValue = selectedMine
    ? decodedId
    : mineKey(mineOptions[0] ?? ({} as Estimation));
  const showDetails = hasProjectDetails(selectedMine);

  function handleSelectChange(newMineId: string) {
    router.push(routes.projects.detail(newMineId));
  }

  function handleModalClose() {
    setShowModeModal(false);
    if (!deliveryMode) {
      router.push(routes.projects.list);
    }
  }

  function handleModalConfirm(mode: DeliveryModeCode) {
    if (!decodedId) return;
    setStoredDeliveryMode(decodedId, mode);
    setDeliveryMode(mode);
    setShowModeModal(false);
  }

  function handleChangeMode() {
    setShowModeModal(true);
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-portal-navy">
            Mine Details
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Switch project or mine to view its cost estimation.
          </p>
        </div>
      
        <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
        <label className="flex w-full flex-col gap-1 text-sm sm:w-auto sm:min-w-[440px]">
            <span className="text-xs font-medium text-slate-500">
              Projects / Mines
            </span>
            <select
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-portal-navy outline-none transition focus:border-portal-purple focus:ring-1 focus:ring-portal-purple/30"
              value={selectedValue}
              onChange={(event) => handleSelectChange(event.target.value)}
            >
              {mineOptions.length === 0 ? (
                <option value={decodedId}>{decodedId || "Loading…"}</option>
              ) : (
                mineOptions.map((mine) => {
                  const lastUpdated = formatLastUpdated(mine.updatedAt);
                  return (
                    <option key={mineKey(mine)} value={mineKey(mine)}>
                      {mine.siteSubtitle || mineKey(mine)}
                      {lastUpdated ? ` — Last updated ${lastUpdated}` : ""}
                    </option>
                  );
                })
              )}
            </select>
          </label>
          {deliveryMode ? (
            <Button type="button" variant="outline" size="sm" onClick={handleChangeMode} className="text-[--color-portal-purple] h-10">
              <MaterialIcon name="settings" size={18} className="text-[--color-portal-purple]" />
            </Button>
          ) : null}
         
        </div>
      </div>

      {!modeReady || showModeModal ? (
        <div className="flex min-h-[min(16rem,40vh)] flex-col items-center justify-center rounded-lg bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200/60">
          {showModeModal
            ? "Choose a delivery mode to continue…"
            : "Loading…"}
        </div>
      ) : deliveryMode === "outsourcing" ? (
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-24 text-sm text-gray-500">
              Loading outsourcing…
            </div>
          }
        >
          <OutsourcingPlaceholder
            projectId={decodedId}
            projectName={selectedMine?.siteSubtitle || decodedId}
            phaseTypes={phaseTypes}
            onChangeMode={handleChangeMode}
          />
        </Suspense>
      ) : showDetails ? (
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-24 text-sm text-gray-500">
              Loading estimation…
            </div>
          }
        >
          <EstimationScreen
            phaseTypes={phaseTypes}
            mineId={decodedId || undefined}
            mineName={selectedMine?.siteSubtitle}
          />
        </Suspense>
      ) : (
        <div className="flex min-h-[min(22rem,55vh)] flex-col items-center justify-center rounded-lg bg-white px-6 py-16 text-center shadow-sm ring-1 ring-gray-200/60">
          <MaterialIcon
            name="folder_off"
            size={32}
            className="text-gray-400"
          />
          <h2 className="mt-4 text-base font-semibold text-portal-navy">
            No project details found
          </h2>
          <p className="mt-1 max-w-md text-sm text-gray-600">
            {selectedMine?.siteSubtitle
              ? `There are no cost estimation details available for “${selectedMine.siteSubtitle}”.`
              : "There are no cost estimation details available for this project."}
          </p>
        </div>
      )}

      <DeliveryModeModal
        open={showModeModal}
        initialMode={deliveryMode}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
      />
    </div>
  );
}
