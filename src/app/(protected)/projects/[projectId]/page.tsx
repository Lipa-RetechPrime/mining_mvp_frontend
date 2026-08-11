'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { listMines, type MineListItem } from '@/features/estimations/api/mines'
import {
  getMineWiseFunctionList,
  getPhaseTypes,
  type MineFunction,
} from '@/features/estimations/api/master'
import {
  DeliveryModeModal,
  type DeliveryModeCode,
  type OutsourcingContributionKind,
  type OutsourcingContributionSettings,
} from '@/features/projects'
import {
  fitToFullSettings,
  fitToPartialSettings,
  getFunctionInvestmentTypeDetails,
  ensureFunctionInvestmentTypeStub,
  persistDeliveryModeChoice,
  resolveDeliveryModeFromApi,
  softFullFieldsFromFit,
  softPartialFieldsFromFit,
} from '@/features/estimations/api/functionInvestmentType'
import {
  getPreferredOutsourcingKind,
  setPreferredDeliveryMode,
  setPreferredOutsourcingKind,
} from '@/features/projects/outsourcingPreference'
import { Button } from '@/shared/components/ui/Button'
import { LoadingOverlay } from '@/shared/components/ui/Loading'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { Modal } from '@/shared/components/ui/Modal'
import { routes } from '@/shared/config/routes'
import type { PhaseTypeMaster } from '@/shared/types'
import {
  formatLastUpdated,
  sortMinesByLastUpdated,
} from '@/shared/utils/mineList'

const EstimationScreen = dynamic(
  () =>
    import('@/features/estimations/components/EstimationScreen').then((m) => ({
      default: m.EstimationScreen,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="relative min-h-[min(16rem,40vh)] rounded-lg bg-white shadow-sm ring-1 ring-gray-200/60">
        <LoadingOverlay />
      </div>
    ),
  },
)

const OutsourcingPlaceholder = dynamic(
  () =>
    import('@/features/projects/OutsourcingPlaceholder').then((m) => ({
      default: m.OutsourcingPlaceholder,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="relative min-h-[min(16rem,40vh)] rounded-lg bg-white shadow-sm ring-1 ring-gray-200/60">
        <LoadingOverlay />
      </div>
    ),
  },
)

function mineKey(mine: MineListItem): string {
  return mine.mine_id || ''
}

const EMPTY_PHASE_TYPES: PhaseTypeMaster[] = []

async function loadOutsourcingSettings(
  mineId: string,
  functionMasterId: string,
  preferredKind?: OutsourcingContributionKind | null,
): Promise<OutsourcingContributionSettings | null> {
  const prefer =
    preferredKind ?? getPreferredOutsourcingKind(mineId, functionMasterId)

  // Active kind only — one details call (plus cache/dedupe).
  const kinds: OutsourcingContributionKind[] = prefer
    ? [prefer]
    : ['partial', 'full', 'adhoc']

  for (const kind of kinds) {
    const fit = await getFunctionInvestmentTypeDetails(
      functionMasterId,
      kind === 'full'
        ? 'full-outsourcing'
        : kind === 'adhoc'
          ? 'adhoc-outsourcing'
          : 'partial-outsourcing',
    )
    if (!fit) continue

    if (kind === 'adhoc') {
      return {
        kind: 'adhoc',
        functionInvestmentTypeId: fit.function_investment_type_id,
      }
    }

    if (kind === 'full') {
      const full = fitToFullSettings(fit)
      if (full) {
        return {
          kind: 'full',
          escalationPercent: full.escalationPercent,
          paybackPeriodYears: full.paybackPeriodYears,
          paybackStartPhase: full.paybackStartPhase,
          functionInvestmentTypeId: full.functionInvestmentTypeId,
        }
      }
      const soft = softFullFieldsFromFit(fit)
      if (
        soft &&
        soft.paybackPeriodYears != null &&
        Number(soft.paybackPeriodYears) > 0 &&
        soft.escalationPercent != null &&
        Number(soft.escalationPercent) >= 0 &&
        soft.paybackStartPhase
      ) {
        return {
          kind: 'full',
          escalationPercent: Number(soft.escalationPercent),
          paybackPeriodYears: Number(soft.paybackPeriodYears),
          paybackStartPhase: soft.paybackStartPhase,
          functionInvestmentTypeId: soft.functionInvestmentTypeId,
        }
      }
      continue
    }

    const partial = fitToPartialSettings(fit)
    if (partial) {
      return {
        kind: 'partial',
        contributionPercentage: partial.contributionPercentage,
        escalationPercent: partial.escalationPercent,
        paybackPeriodYears: partial.paybackPeriodYears,
        functionInvestmentTypeId: partial.functionInvestmentTypeId,
      }
    }
    const soft = softPartialFieldsFromFit(fit)
    if (
      soft &&
      soft.paybackPeriodYears != null &&
      soft.paybackPeriodYears > 0 &&
      soft.contributionPercentage != null &&
      soft.contributionPercentage >= 0 &&
      soft.escalationPercent != null &&
      soft.escalationPercent >= 0
    ) {
      return {
        kind: 'partial',
        contributionPercentage: soft.contributionPercentage,
        escalationPercent: soft.escalationPercent,
        paybackPeriodYears: soft.paybackPeriodYears,
        functionInvestmentTypeId: soft.functionInvestmentTypeId,
      }
    }
  }

  return null
}

function ProjectDetailsContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const projectIdRaw = Array.isArray(params?.projectId)
    ? params.projectId[0]
    : params?.projectId
  const decodedId = projectIdRaw ? decodeURIComponent(projectIdRaw) : ''

  const [mines, setMines] = useState<MineListItem[]>([])
  const [minesLoading, setMinesLoading] = useState(true)
  const [phaseTypes, setPhaseTypes] =
    useState<PhaseTypeMaster[]>(EMPTY_PHASE_TYPES)
  const [mineFunctions, setMineFunctions] = useState<MineFunction[]>([])
  const [mineFunctionsLoading, setMineFunctionsLoading] = useState(false)
  const [deliveryMode, setDeliveryMode] = useState<DeliveryModeCode | null>(
    null,
  )
  const [modeReady, setModeReady] = useState(false)
  const [showModeModal, setShowModeModal] = useState(false)
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false)
  /** When true, show outsourcing config even if a valid config exists. */
  const [forceOutsourcingConfig, setForceOutsourcingConfig] = useState(false)
  const [outsourcingPartial, setOutsourcingPartial] =
    useState<OutsourcingContributionSettings | null>(null)
  const [ownershipFitId, setOwnershipFitId] = useState<string | null>(null)
  const [partialSettingsLoading, setPartialSettingsLoading] = useState(false)
  const estimationDirtyRef = useRef(false)

  const sectorParam = searchParams.get('sector') || ''

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const types = await getPhaseTypes()
        if (!cancelled) setPhaseTypes(types)
      } catch {
        if (!cancelled) setPhaseTypes(EMPTY_PHASE_TYPES)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setMinesLoading(true)
    void (async () => {
      try {
        const list = await listMines()
        if (cancelled) return
        setMines(list)
      } catch {
        if (!cancelled) setMines([])
      } finally {
        if (!cancelled) setMinesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mineOptions = useMemo(
    () => sortMinesByLastUpdated(mines),
    [mines],
  )

  const selectedMine =
    mineOptions.find((mine) => mineKey(mine) === decodedId) ??
    mineOptions[0]

  const selectedValue = selectedMine ? mineKey(selectedMine) : decodedId
  const activeMineId = selectedValue || decodedId

  useEffect(() => {
    if (!activeMineId) {
      setMineFunctions([])
      setMineFunctionsLoading(false)
      return
    }
    let cancelled = false
    setMineFunctionsLoading(true)
    void (async () => {
      try {
        const list = await getMineWiseFunctionList(activeMineId)
        if (!cancelled) setMineFunctions(list)
      } catch {
        if (!cancelled) setMineFunctions([])
      } finally {
        if (!cancelled) setMineFunctionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeMineId])

  // Drop / replace stale ?sector= when it is not on this mine.
  useEffect(() => {
    if (!activeMineId || mineFunctionsLoading) return
    const current = searchParams.get('sector')
    if (!current) {
      if (mineFunctions[0]?.function_master_id) {
        const next = new URLSearchParams(searchParams.toString())
        next.set('sector', mineFunctions[0].function_master_id)
        router.replace(
          `${routes.projects.detail(activeMineId)}?${next.toString()}`,
          { scroll: false },
        )
      }
      return
    }
    if (mineFunctions.some((fn) => fn.function_master_id === current)) return

    const next = new URLSearchParams(searchParams.toString())
    if (mineFunctions[0]?.function_master_id) {
      next.set('sector', mineFunctions[0].function_master_id)
    } else {
      next.delete('sector')
    }
    const qs = next.toString()
    router.replace(
      qs
        ? `${routes.projects.detail(activeMineId)}?${qs}`
        : routes.projects.detail(activeMineId),
      { scroll: false },
    )
  }, [
    mineFunctionsLoading,
    mineFunctions,
    searchParams,
    activeMineId,
    router,
  ])

  const functionMasterId = useMemo(() => {
    if (
      sectorParam &&
      mineFunctions.some((fn) => fn.function_master_id === sectorParam)
    ) {
      return sectorParam
    }
    return mineFunctions[0]?.function_master_id || ''
  }, [sectorParam, mineFunctions])

  const activeFunction = useMemo(
    () =>
      mineFunctions.find((fn) => fn.function_master_id === functionMasterId) ??
      null,
    [mineFunctions, functionMasterId],
  )

  // Delivery mode + outsourcing settings from FunctionInvestmentType API.
  useEffect(() => {
    if (!activeMineId || !functionMasterId) {
      setDeliveryMode(null)
      setModeReady(false)
      setShowModeModal(false)
      setForceOutsourcingConfig(false)
      setOutsourcingPartial(null)
      setOwnershipFitId(null)
      setPartialSettingsLoading(false)
      return
    }

    let cancelled = false
    setModeReady(false)
    setPartialSettingsLoading(true)
    setForceOutsourcingConfig(false)
    // Drop prior function's FIT/settings immediately so we never scope the
    // new function with the previous function's outsourcing FIT id.
    setOutsourcingPartial(null)
    setOwnershipFitId(null)

    void (async () => {
      try {
        const mode = await resolveDeliveryModeFromApi(
          activeMineId,
          functionMasterId,
        )
        if (cancelled) return
        setDeliveryMode(mode)
        setShowModeModal(!mode)

        if (mode === 'outsourcing') {
          const settings = await loadOutsourcingSettings(
            activeMineId,
            functionMasterId,
          )
          if (cancelled) return
          setOutsourcingPartial(settings)
          setOwnershipFitId(null)
        } else if (mode === 'ownership') {
          const ownership = await ensureFunctionInvestmentTypeStub(
            functionMasterId,
            'ownership',
          )
          if (cancelled) return
          setOutsourcingPartial(null)
          setOwnershipFitId(ownership.function_investment_type_id)
        } else {
          setOutsourcingPartial(null)
          setOwnershipFitId(null)
        }
      } catch {
        if (cancelled) return
        setDeliveryMode(null)
        setShowModeModal(true)
        setOutsourcingPartial(null)
        setOwnershipFitId(null)
      } finally {
        if (!cancelled) {
          setModeReady(true)
          setPartialSettingsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeMineId, functionMasterId])

  // Re-load outsourcing settings when returning from "Edit outsourcing config".
  // Skip when we already have settings (e.g. just saved & continued) so a
  // slow/failed re-fetch cannot leave the user stuck on the config screen.
  useEffect(() => {
    if (
      !functionMasterId ||
      deliveryMode !== 'outsourcing' ||
      forceOutsourcingConfig
    ) {
      return
    }
    if (outsourcingPartial) return

    let cancelled = false
    setPartialSettingsLoading(true)
    void (async () => {
      try {
        const settings = await loadOutsourcingSettings(
          activeMineId,
          functionMasterId,
        )
        if (cancelled) return
        setOutsourcingPartial(settings)
      } catch {
        if (!cancelled) setOutsourcingPartial(null)
      } finally {
        if (!cancelled) setPartialSettingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    functionMasterId,
    activeMineId,
    deliveryMode,
    forceOutsourcingConfig,
    outsourcingPartial,
  ])

  useEffect(() => {
    if (minesLoading || mineOptions.length === 0 || !decodedId) return
    const exists = mineOptions.some((mine) => mineKey(mine) === decodedId)
    if (exists) return
    const fallback = mineKey(mineOptions[0])
    if (fallback && fallback !== decodedId) {
      router.replace(routes.projects.detail(fallback))
    }
  }, [minesLoading, mineOptions, decodedId, router])

  function handleSelectChange(newMineId: string) {
    if (!newMineId || newMineId === activeMineId) return
    router.push(routes.projects.detail(newMineId))
  }

  async function handleModalConfirm(mode: DeliveryModeCode) {
    if (!activeMineId || !functionMasterId) return
    try {
      await persistDeliveryModeChoice(activeMineId, functionMasterId, mode)
      setPreferredDeliveryMode(activeMineId, functionMasterId, mode)
      setDeliveryMode(mode)
      setShowModeModal(false)
      setForceOutsourcingConfig(mode === 'outsourcing')
      estimationDirtyRef.current = false
      if (mode === 'outsourcing') {
        setOutsourcingPartial(null)
        setOwnershipFitId(null)
      } else {
        setOutsourcingPartial(null)
        const ownership = await ensureFunctionInvestmentTypeStub(
          functionMasterId,
          'ownership',
        )
        setOwnershipFitId(ownership.function_investment_type_id)
      }
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : 'Failed to save delivery mode. Try again.',
      )
    }
  }

  const activeFunctionInvestmentTypeId =
    deliveryMode === 'outsourcing'
      ? (outsourcingPartial?.functionInvestmentTypeId ?? null)
      : deliveryMode === 'ownership'
        ? ownershipFitId
        : null

  function handleChangeMode() {
    if (estimationDirtyRef.current) {
      setShowUnsavedConfirm(true)
      return
    }
    setShowModeModal(true)
  }

  /** First-time outsourcing setup replaces the page; edit opens a modal over tables. */
  const showOutsourcingSetupPage =
    deliveryMode === 'outsourcing' &&
    !partialSettingsLoading &&
    !outsourcingPartial

  const showOutsourcingEditModal =
    deliveryMode === 'outsourcing' &&
    forceOutsourcingConfig &&
    Boolean(outsourcingPartial)

  const waitingForActiveFit =
    Boolean(deliveryMode) &&
    !showOutsourcingSetupPage &&
    !activeFunctionInvestmentTypeId &&
    (deliveryMode === 'ownership' ||
      (deliveryMode === 'outsourcing' && !partialSettingsLoading))

  const waitingForFunction = !functionMasterId
  const noFunctionsForMine =
    !mineFunctionsLoading && mineFunctions.length === 0 && Boolean(activeMineId)

  /** Block main content only before a first delivery-mode choice exists. */
  const showFirstTimeModeGate =
    showModeModal && !deliveryMode

  const showInstructionPanel =
    showFirstTimeModeGate ||
    noFunctionsForMine ||
    (waitingForFunction && !mineFunctionsLoading)

  /** One overlay instead of mine-select + body (+ side-nav) spinners together. */
  const showPageLoadingOverlay =
    !showInstructionPanel &&
    (minesLoading ||
      mineFunctionsLoading ||
      waitingForActiveFit ||
      !modeReady ||
      (deliveryMode === 'outsourcing' && partialSettingsLoading))

  const functionOptions = useMemo(
    () =>
      mineFunctions.map((fn) => ({
        id: fn.function_master_id,
        name: fn.function_name,
      })),
    [mineFunctions],
  )

  return (
    <div
      className="relative min-w-0 space-y-5"
      aria-busy={showPageLoadingOverlay}
    >
      {showPageLoadingOverlay ? <LoadingOverlay /> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-portal-navy">
            Mine Details
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Select a project/mine. Ownership / Outsourcing is set per cost
            function for the selected mine.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
          <label className="flex w-full flex-col gap-1 text-sm sm:w-auto sm:min-w-[440px]">
            <span className="text-xs font-medium text-slate-500">
              Projects / Mines
            </span>
            <select
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-portal-navy outline-none transition focus:border-portal-purple focus:ring-1 focus:ring-portal-purple/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
              value={mineOptions.length === 0 ? '' : selectedValue}
              onChange={(event) => handleSelectChange(event.target.value)}
              disabled={minesLoading || mineOptions.length === 0}
              aria-label="Projects / Mines"
            >
              {minesLoading ? (
                <option value="" />
              ) : mineOptions.length === 0 ? (
                <option value="">No mines available</option>
              ) : (
                mineOptions.map((mine) => {
                  const lastUpdated = formatLastUpdated(mine.updatedAt)
                  return (
                    <option key={mineKey(mine)} value={mineKey(mine)}>
                      {mine.mine_name || mineKey(mine)}
                      {lastUpdated ? ` — Last updated ${lastUpdated}` : ''}
                    </option>
                  )
                })
              )}
            </select>
          </label>
          {deliveryMode && functionMasterId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleChangeMode}
              className="text-[--color-portal-purple] h-10"
              title="Change ownership / outsourcing"
            >
              <MaterialIcon
                name="settings"
                size={18}
                className="text-[--color-portal-purple]"
              />
              <span className="hidden sm:inline">Delivery mode</span>
            </Button>
          ) : null}
        </div>
      </div>

      {showFirstTimeModeGate ? (
        <div className="flex min-h-[min(16rem,40vh)] flex-col items-center justify-center rounded-lg bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200/60">
          Choose a delivery mode for this cost function…
        </div>
      ) : noFunctionsForMine ? (
        <div className="flex min-h-[min(16rem,40vh)] flex-col items-center justify-center rounded-lg bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200/60">
          No cost functions for this mine. Select another project from the list.
        </div>
      ) : waitingForFunction && !mineFunctionsLoading ? (
        <div className="flex min-h-[min(16rem,40vh)] flex-col items-center justify-center rounded-lg bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200/60">
          Select a cost function…
        </div>
      ) : showPageLoadingOverlay ? (
        <div
          className="min-h-[min(16rem,40vh)] rounded-lg bg-white shadow-sm ring-1 ring-gray-200/60"
          aria-hidden
        />
      ) : showOutsourcingSetupPage ? (
        <Suspense
          fallback={
            <div className="relative min-h-[min(16rem,40vh)] rounded-lg bg-white shadow-sm ring-1 ring-gray-200/60">
              <LoadingOverlay />
            </div>
          }
        >
          <OutsourcingPlaceholder
            projectId={activeMineId}
            projectName={selectedMine?.mine_name || activeMineId}
            phaseTypes={phaseTypes}
            functionOptions={functionOptions}
            initialSettings={outsourcingPartial}
            onChangeMode={handleChangeMode}
            onContinueToEstimation={(kind, settings) => {
              setPreferredOutsourcingKind(activeMineId, functionMasterId, kind)
              setOutsourcingPartial(settings)
              setPartialSettingsLoading(false)
              setForceOutsourcingConfig(false)
            }}
          />
        </Suspense>
      ) : deliveryMode === 'outsourcing' || mineOptions.length > 0 ? (
        <Suspense
          fallback={
            <div className="relative min-h-[min(16rem,40vh)] rounded-lg bg-white shadow-sm ring-1 ring-gray-200/60">
              <LoadingOverlay />
            </div>
          }
        >
          <EstimationScreen
            phaseTypes={phaseTypes}
            mineId={activeMineId || undefined}
            mineName={selectedMine?.mine_name}
            functionInvestmentTypeId={activeFunctionInvestmentTypeId}
            outsourcingPartial={
              deliveryMode === 'outsourcing' ? outsourcingPartial : null
            }
            onEditOutsourcingConfig={
              deliveryMode === 'outsourcing'
                ? () => setForceOutsourcingConfig(true)
                : undefined
            }
            onUnsavedChangesChange={(dirty) => {
              estimationDirtyRef.current = dirty
            }}
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
            No mines/projects found
          </h2>
          <p className="mt-1 max-w-md text-sm text-gray-600">
            Add cost estimations to open a project with a valid mine id.
          </p>
        </div>
      )}

      <DeliveryModeModal
        open={showModeModal}
        initialMode={deliveryMode}
        functionName={activeFunction?.function_name}
        dismissible={Boolean(deliveryMode)}
        onClose={() => setShowModeModal(false)}
        onConfirm={(mode) => {
          void handleModalConfirm(mode)
        }}
      />

      <Modal
        open={showOutsourcingEditModal}
        title="Edit outsourcing configuration"
        size="xl"
        onClose={() => setForceOutsourcingConfig(false)}
        backdropClassName="bg-black/30 backdrop-blur-sm"
        className="max-h-[90vh] overflow-y-auto"
      >
        <Suspense
          fallback={
            <div className="relative min-h-[8rem]">
              <LoadingOverlay />
            </div>
          }
        >
          <OutsourcingPlaceholder
            projectId={activeMineId}
            projectName={selectedMine?.mine_name || activeMineId}
            phaseTypes={phaseTypes}
            functionOptions={functionOptions}
            initialSettings={outsourcingPartial}
            onChangeMode={() => {
              setForceOutsourcingConfig(false)
              handleChangeMode()
            }}
            onCancel={() => setForceOutsourcingConfig(false)}
            onContinueToEstimation={(kind, settings) => {
              setPreferredOutsourcingKind(activeMineId, functionMasterId, kind)
              setOutsourcingPartial(settings)
              setPartialSettingsLoading(false)
              setForceOutsourcingConfig(false)
            }}
          />
        </Suspense>
      </Modal>

      <Modal
        open={showUnsavedConfirm}
        title="Unsaved changes"
        onClose={() => setShowUnsavedConfirm(false)}
        backdropClassName="bg-black/30 backdrop-blur-sm"
        className="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setShowUnsavedConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowUnsavedConfirm(false)
                estimationDirtyRef.current = false
                setShowModeModal(true)
              }}
            >
              OK
            </Button>
          </>
        }
      >
        <p className="text-sm text-portal-navy">
          ALL UNSAVED CHANGES WILL BE GONE
        </p>
      </Modal>
    </div>
  )
}

export default function ProjectDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-[min(16rem,40vh)] rounded-lg bg-white shadow-sm ring-1 ring-gray-200/60">
          <LoadingOverlay />
        </div>
      }
    >
      <ProjectDetailsContent />
    </Suspense>
  )
}
