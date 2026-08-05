'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { EstimationScreen } from '@/features/estimations'
import { listMines, type MineListItem } from '@/features/estimations/api/mines'
import {
  getMineWiseFunctionList,
  getPhaseTypes,
  type MineFunction,
} from '@/features/estimations/api/master'
import {
  DeliveryModeModal,
  OutsourcingPlaceholder,
  type DeliveryModeCode,
  type OutsourcingContributionKind,
  type OutsourcingContributionSettings,
} from '@/features/projects'
import {
  fitToFullSettings,
  fitToPartialSettings,
  getFunctionInvestmentTypeDetails,
  persistDeliveryModeChoice,
  resolveDeliveryModeFromApi,
} from '@/features/estimations/api/functionInvestmentType'
import {
  getPreferredOutsourcingKind,
  setPreferredDeliveryMode,
  setPreferredOutsourcingKind,
} from '@/features/projects/outsourcingPreference'
import { Button } from '@/shared/components/ui/Button'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { Modal } from '@/shared/components/ui/Modal'
import { routes } from '@/shared/config/routes'
import type { PhaseTypeMaster } from '@/shared/types'
import {
  formatLastUpdated,
  sortMinesByLastUpdated,
} from '@/shared/utils/mineList'

function mineKey(mine: MineListItem): string {
  return mine.mine_id || ''
}

const EMPTY_PHASE_TYPES: PhaseTypeMaster[] = []

async function loadOutsourcingSettings(
  functionMasterId: string,
  preferredKind?: OutsourcingContributionKind | null,
): Promise<OutsourcingContributionSettings | null> {
  const [partialFit, fullFit, adhocFit] = await Promise.all([
    getFunctionInvestmentTypeDetails(functionMasterId, 'partial-outsourcing'),
    getFunctionInvestmentTypeDetails(functionMasterId, 'full-outsourcing'),
    getFunctionInvestmentTypeDetails(functionMasterId, 'adhoc-outsourcing'),
  ])
  const prefer =
    preferredKind ?? getPreferredOutsourcingKind(functionMasterId)

  if (prefer === 'adhoc' && adhocFit) {
    return {
      kind: 'adhoc',
      functionInvestmentTypeId: adhocFit.function_investment_type_id,
    }
  }

  const partial = fitToPartialSettings(partialFit)
  const full = fitToFullSettings(fullFit)

  if (prefer === 'full' && full) {
    return {
      kind: 'full',
      escalationPercent: full.escalationPercent,
      paybackPeriodYears: full.paybackPeriodYears,
      paybackStartPhase: full.paybackStartPhase,
      functionInvestmentTypeId: full.functionInvestmentTypeId,
    }
  }
  if (prefer === 'partial' && partial) {
    return {
      kind: 'partial',
      contributionPercentage: partial.contributionPercentage,
      escalationPercent: partial.escalationPercent,
      paybackPeriodYears: partial.paybackPeriodYears,
      functionInvestmentTypeId: partial.functionInvestmentTypeId,
    }
  }

  if (partial) {
    return {
      kind: 'partial',
      contributionPercentage: partial.contributionPercentage,
      escalationPercent: partial.escalationPercent,
      paybackPeriodYears: partial.paybackPeriodYears,
      functionInvestmentTypeId: partial.functionInvestmentTypeId,
    }
  }
  if (full) {
    return {
      kind: 'full',
      escalationPercent: full.escalationPercent,
      paybackPeriodYears: full.paybackPeriodYears,
      paybackStartPhase: full.paybackStartPhase,
      functionInvestmentTypeId: full.functionInvestmentTypeId,
    }
  }
  if (adhocFit) {
    return {
      kind: 'adhoc',
      functionInvestmentTypeId: adhocFit.function_investment_type_id,
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

  const functionMasterId = searchParams.get('sector') || ''

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
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const list = await getMineWiseFunctionList(activeMineId)
        if (!cancelled) setMineFunctions(list)
      } catch {
        if (!cancelled) setMineFunctions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeMineId])

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

    void (async () => {
      try {
        const mode = await resolveDeliveryModeFromApi(functionMasterId)
        if (cancelled) return
        setDeliveryMode(mode)
        setShowModeModal(!mode)

        if (mode === 'outsourcing') {
          const settings = await loadOutsourcingSettings(functionMasterId)
          if (cancelled) return
          setOutsourcingPartial(settings)
          setOwnershipFitId(null)
        } else if (mode === 'ownership') {
          const ownership = await getFunctionInvestmentTypeDetails(
            functionMasterId,
            'ownership',
          )
          if (cancelled) return
          setOutsourcingPartial(null)
          setOwnershipFitId(ownership?.function_investment_type_id ?? null)
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
        const settings = await loadOutsourcingSettings(functionMasterId)
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
    router.push(routes.projects.detail(newMineId))
  }

  async function handleModalConfirm(mode: DeliveryModeCode) {
    if (!activeMineId || !functionMasterId) return
    try {
      await persistDeliveryModeChoice(functionMasterId, mode)
      setPreferredDeliveryMode(functionMasterId, mode)
      setDeliveryMode(mode)
      setShowModeModal(false)
      setForceOutsourcingConfig(mode === 'outsourcing')
      estimationDirtyRef.current = false
      if (mode === 'outsourcing') {
        setOutsourcingPartial(null)
        setOwnershipFitId(null)
      } else {
        setOutsourcingPartial(null)
        const ownership = await getFunctionInvestmentTypeDetails(
          functionMasterId,
          'ownership',
        )
        setOwnershipFitId(ownership?.function_investment_type_id ?? null)
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

  const showOutsourcingConfig =
    deliveryMode === 'outsourcing' &&
    (forceOutsourcingConfig ||
      (!partialSettingsLoading && !outsourcingPartial))

  const waitingForActiveFit =
    Boolean(deliveryMode) &&
    !showOutsourcingConfig &&
    !activeFunctionInvestmentTypeId &&
    (deliveryMode === 'ownership' ||
      (deliveryMode === 'outsourcing' && !partialSettingsLoading))

  const waitingForFunction = !functionMasterId

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-portal-navy">
            Mine Details
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Switch project or mine. Ownership / Outsourcing is set per cost
            function.
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
              disabled={minesLoading}
            >
              {mineOptions.length === 0 ? (
                <option value={decodedId}>
                  {minesLoading ? 'Loading…' : decodedId || 'No mines'}
                </option>
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
            >
              <MaterialIcon
                name="settings"
                size={18}
                className="text-[--color-portal-purple]"
              />
            </Button>
          ) : null}
        </div>
      </div>

      {!modeReady ||
      showModeModal ||
      minesLoading ||
      waitingForFunction ||
      waitingForActiveFit ? (
        <div className="flex min-h-[min(16rem,40vh)] flex-col items-center justify-center rounded-lg bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200/60">
          {showModeModal
            ? 'Choose a delivery mode for this cost function…'
            : waitingForFunction
              ? 'Select a cost function…'
              : 'Loading…'}
        </div>
      ) : deliveryMode === 'outsourcing' && partialSettingsLoading ? (
        <div className="flex min-h-[min(16rem,40vh)] flex-col items-center justify-center rounded-lg bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200/60">
          Loading outsourcing configuration…
        </div>
      ) : deliveryMode === 'outsourcing' && showOutsourcingConfig ? (
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-24 text-sm text-gray-500">
              Loading outsourcing…
            </div>
          }
        >
          <OutsourcingPlaceholder
            projectId={activeMineId}
            projectName={selectedMine?.mine_name || activeMineId}
            phaseTypes={phaseTypes}
            onChangeMode={handleChangeMode}
            onContinueToEstimation={(kind, settings) => {
              setPreferredOutsourcingKind(functionMasterId, kind)
              setOutsourcingPartial(settings)
              setPartialSettingsLoading(false)
              setForceOutsourcingConfig(false)
            }}
          />
        </Suspense>
      ) : deliveryMode === 'outsourcing' || mineOptions.length > 0 ? (
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-24 text-sm text-gray-500">
              Loading estimation…
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
        onConfirm={handleModalConfirm}
      />

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
        <div className="flex min-h-[min(16rem,40vh)] flex-col items-center justify-center rounded-lg bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200/60">
          Loading…
        </div>
      }
    >
      <ProjectDetailsContent />
    </Suspense>
  )
}
