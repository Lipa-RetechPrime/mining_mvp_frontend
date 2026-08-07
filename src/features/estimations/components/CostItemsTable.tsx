import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/shared/components/ui/Button'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { Modal } from '@/shared/components/ui/Modal'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { EntityTabs } from './EntityTabs'
import { EstimationBlockHeader } from './EstimationBlockHeader'
import { CostItemsDraftForm } from './CostItemsDraftForm'
import { OverallCostTable } from './OverallCostTable'
import { OVERALL_TAB_CODE, OVERALL_TAB_ID } from '../constants/entityTabs'
import {
  addCostItemsToEstimation,
  downloadEstimationExcel,
  fetchOverallList,
  isStepPopulated,
  removeCostItemFromEstimation,
  scopeEstimationToInvestmentType,
} from '../api/investments'
import { asUuidOrNull } from '../api/investments/domain'
import type { OverallListData } from '../api/investments/types'
import type { Estimation, PhaseTypeMaster, Step } from '../types/estimation'
import { buildEntityOverallListData } from '../utils/overallTable'
import { resolveElectrificationPercentForEntity } from '../utils/validation'

type PendingDelete =
  | { kind: 'row'; step: Step }
  | { kind: 'table' }


function EstimationTableCard({  estimation,
  phaseTypes,
  functionMasterId: functionMasterIdProp,
  functionName,
  functionInvestmentTypeId,
  includeLegacyNullFit,
  onEdit,
  onDelete,
  onChanged,
  onItemUpdated,
}: {
  estimation: Estimation
  phaseTypes: PhaseTypeMaster[]
  functionMasterId?: string | null
  functionName?: string | null
  functionInvestmentTypeId?: string | null
  includeLegacyNullFit?: boolean
  onEdit: (estimationId: string, entityId: string) => void
  onDelete: (estimationId: string) => void | Promise<void>
  onChanged: () => void | Promise<void>
  onItemUpdated: (estimation: Estimation) => void
}) {
  const searchParams = useSearchParams()
  const functionMasterId =
    asUuidOrNull(functionMasterIdProp) ||
    asUuidOrNull(searchParams.get('sector')) ||
    asUuidOrNull(estimation.blocks[0]?.sectorId) ||
    asUuidOrNull(estimation.blocks[0]?.id) ||
    ''

  const scopedEstimation = functionMasterId
    ? scopeEstimationToInvestmentType(
        estimation,
        functionInvestmentTypeId,
        functionMasterId,
        {
          includeLegacyNullFit,
          functionName,
        },
      )
    : estimation

  const block =
    scopedEstimation.blocks.find((candidate) => candidate.sectorId === functionMasterId) ??
    scopedEstimation.blocks[0]
  const displaySectorName =
    functionName?.trim() ||
    (block?.sectorName?.trim() &&
    block.sectorName.trim().toLowerCase() !== 'cost function'
      ? block.sectorName.trim()
      : '') ||
    'Cost function'
  const tabs = block?.entityTabs ?? []
  const [activeEntityId, setActiveEntityId] = useState(() => OVERALL_TAB_ID)
  const [addingCostItems, setAddingCostItems] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [overallData, setOverallData] = useState<OverallListData | null>(null)
  const [overallLoading, setOverallLoading] = useState(false)
  const [overallError, setOverallError] = useState<string | null>(null)

  const isOverallTab = activeEntityId === OVERALL_TAB_ID
  const activeTab = tabs.find((t) => t.entityId === activeEntityId) ?? tabs[0]
  const populatedSteps = (activeTab?.steps ?? []).filter(isStepPopulated)
  const hasData = populatedSteps.length > 0
  const entityTabsForUi = [
    { id: OVERALL_TAB_ID, code: OVERALL_TAB_CODE },
    ...tabs.map((t) => ({ id: t.entityId, code: t.entityCode })),
  ]

  const entityOverallData = useMemo(() => {
    if (isOverallTab || !activeTab || populatedSteps.length === 0) return null
    return buildEntityOverallListData({
      steps: populatedSteps,
      entityCode: activeTab.entityCode,
      entityId: activeTab.entityId,
      electrificationPercent: resolveElectrificationPercentForEntity(
        scopedEstimation.electrificationPercentByEntity ?? {},
        activeTab,
        tabs,
      ),
      functionName: displaySectorName,
      mineId: estimation.mine_id || estimation.id || '',
      mineName: estimation.siteSubtitle || '',
    })
  }, [
    isOverallTab,
    activeTab,
    populatedSteps,
    scopedEstimation.electrificationPercentByEntity,
    tabs,
    displaySectorName,
    estimation.mine_id,
    estimation.id,
    estimation.siteSubtitle,
  ])

  const loadOverall = useCallback(async () => {
    if (!estimation.mine_id || !functionMasterId) {
      setOverallData(null)
      if (!functionMasterId) {
        setOverallError('Select a cost function to load the overall summary.')
      }
      return
    }
    setOverallLoading(true)
    setOverallError(null)
    try {
      const data = await fetchOverallList(
        estimation.mine_id,
        functionMasterId,
        functionInvestmentTypeId ?? scopedEstimation.functionInvestmentTypeId,
      )
      setOverallData(data)
    } catch (error) {
      setOverallData(null)
      setOverallError(
        error instanceof Error ? error.message : 'Failed to load overall summary.',
      )
    } finally {
      setOverallLoading(false)
    }
  }, [
    estimation.mine_id,
    functionInvestmentTypeId,
    scopedEstimation.functionInvestmentTypeId,
    functionMasterId,
  ])

  // Fetch overall when the Overall tab is active (mine/function change while on it included).
  useEffect(() => {
    if (!isOverallTab) return
    let cancelled = false

    async function run() {
      if (!estimation.mine_id || !functionMasterId) {
        if (!cancelled) {
          setOverallData(null)
          setOverallLoading(false)
          setOverallError(
            functionMasterId
              ? null
              : 'Select a cost function to load the overall summary.',
          )
        }
        return
      }
      if (!cancelled) {
        setOverallLoading(true)
        setOverallError(null)
      }
      try {
        const data = await fetchOverallList(
          estimation.mine_id,
          functionMasterId,
          functionInvestmentTypeId ?? scopedEstimation.functionInvestmentTypeId,
        )
        if (!cancelled) setOverallData(data)
      } catch (error) {
        if (!cancelled) {
          setOverallData(null)
          setOverallError(
            error instanceof Error ? error.message : 'Failed to load overall summary.',
          )
        }
      } finally {
        if (!cancelled) setOverallLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    isOverallTab,
    estimation.mine_id,
    functionInvestmentTypeId,
    scopedEstimation.functionInvestmentTypeId,
    functionMasterId,
  ])

  if (!block || !estimation.id) return null

  async function handleSaveSteps(steps: Step[], electrificationPercent: number | null) {
    if (!estimation.id || !activeTab) return
    setSaveError(null)
    // Delivery mode / FIT is per cost function (shared by ECL and MDO), not per entity.
    const fitId =
      functionInvestmentTypeId?.trim() ||
      scopedEstimation.functionInvestmentTypeId?.trim() ||
      null
    if (!fitId) {
      setSaveError(
        'Select Ownership or save Outsourcing configuration before saving cost items.',
      )
      throw new Error('save failed')
    }
    try {
      const baseForSave: Estimation = {
        ...scopedEstimation,
        id: estimation.id,
        mine_id: estimation.mine_id || estimation.id,
        functionInvestmentTypeId: fitId,
      }
      const updated = await addCostItemsToEstimation(
        estimation.id,
        activeTab.entityId,
        steps,
        baseForSave,
        electrificationPercent,
        fitId,
      )
      onItemUpdated({
        ...updated,
        functionInvestmentTypeId:
          updated.functionInvestmentTypeId?.trim() || fitId,
      })
      setAddingCostItems(false)
      await onChanged()
      if (isOverallTab) await loadOverall()
    } catch (error) {
      const message =
        error instanceof Error && error.message && error.message !== 'save failed'
          ? error.message
          : 'Failed to save cost item. Please try again.'
      setSaveError(message)
      throw new Error('save failed')
    }
  }

  async function handleConfirmDelete() {
    if (!estimation.id || !pendingDelete) return
    setDeleting(true)
    setSaveError(null)
    try {
      if (pendingDelete.kind === 'table') {
        await onDelete(estimation.id)
      } else {
        if (!activeTab) return
        const updated = await removeCostItemFromEstimation(
          estimation.id,
          activeTab.entityId,
          pendingDelete.step.id,
        )
        // Keep this tab selected and show the empty message immediately.
        onItemUpdated(updated)
        setAddingCostItems(false)
        if (isOverallTab) await loadOverall()
      }
      setPendingDelete(null)
    } catch {
      setSaveError(
        pendingDelete.kind === 'table'
          ? 'Failed to delete estimation. Please try again.'
          : 'Failed to delete cost item. Please try again.',
      )
    } finally {
      setDeleting(false)
    }
  }

  async function handleDownloadExcel() {
    if (!estimation.mine_id) {
      setSaveError('Cannot download: estimation is missing mine_id.')
      return
    }
    setDownloading(true)
    setSaveError(null)
    try {
      await downloadEstimationExcel(estimation.mine_id)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to download Excel. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  const deleteModal =
    pendingDelete?.kind === 'table'
      ? {
          title: 'Delete estimation?',
          message: (
            <>
              Are you sure you want to delete this entire estimation for{' '}
              <span className="font-semibold text-[--color-portal-navy]">{displaySectorName}</span>? This
              cannot be undone.
            </>
          ),
        }
      : {
          title: 'Delete cost item?',
          message: (
            <>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-[--color-portal-navy]">
                {pendingDelete?.step.details?.trim() || 'Untitled Cost Item'}
              </span>
              ? This cannot be undone.
            </>
          ),
        }

  return (
    <article className="mb-5 rounded-card bg-white px-6 py-7 sm:px-8 sm:py-8">
      <EstimationBlockHeader
        sectorName={displaySectorName}
        appendixLabel={estimation.appendixLabel}
        siteSubtitle={estimation.siteSubtitle}
      />
      <EntityTabs
        tabs={entityTabsForUi}
        activeId={isOverallTab ? OVERALL_TAB_ID : (activeTab?.entityId ?? '')}
        onChange={(id) => {
          setActiveEntityId(id)
          setAddingCostItems(false)
          setSaveError(null)
          setPendingDelete(null)
        }}
        actions={
          <>
            {isOverallTab ? (
              <>
              <Button
                variant="secondary"
                className="!px-3 !py-1.5 !text-xs"
                onClick={() => void handleDownloadExcel()}
                disabled={downloading || !estimation.mine_id}
              >
                <MaterialIcon name="download" size={14} />
                {downloading ? 'Downloading…' : 'Download'}
              </Button>
              <Button
              variant="secondary"
              className="!px-3 !py-1.5 !text-xs"
              onClick={() => {
                const firstWithData = tabs.find((t) =>
                  t.steps.some(isStepPopulated),
                )
                onEdit(
                  estimation.id!,
                  isOverallTab
                    ? (firstWithData?.entityId ?? tabs[0]?.entityId ?? '')
                    : (activeTab?.entityId ?? ''),
                )
              }}
              aria-label="Edit estimation"
            >
              <MaterialIcon name="edit" size={14} />
              Edit
            </Button>
              </>
            ) : null}
            
            {/* <Button
              variant="outline"
              className="!px-2 !py-1.5 !text-xs text-white border-red-600 hover:text-red-700 bg-red-600 hover:bg-white hover:text-red-600 "
              onClick={() => setPendingDelete({ kind: 'table' })}
              aria-label="Delete estimation"
            >
              <MaterialIcon name="delete" size={14}/>
              Delete
            </Button> */}
          </>
        }
      />

      {isOverallTab ? (
        overallLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg
              className="h-8 w-8 animate-spin text-portal-purple"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
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
            <p className="mt-3 text-sm text-gray-500">Loading overall summary…</p>
          </div>
        ) : overallError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {overallError}
          </p>
        ) : overallData ? (
          <OverallCostTable
            data={overallData}
            phaseLimit={estimation.phaseLimit}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-portal-border px-6 py-10 text-center text-sm text-gray-500">
            No overall data available for this estimation.
          </div>
        )
      ) : activeTab && hasData && entityOverallData ? (
        <>
          <OverallCostTable
            data={entityOverallData}
            phaseLimit={estimation.phaseLimit}
            showFormulas
            onRequestDelete={(costItemId) => {
              const step = populatedSteps.find((candidate) => candidate.id === costItemId)
              if (step) setPendingDelete({ kind: 'row', step })
            }}
          />
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-portal-purple-soft px-3.5 py-1.5 text-[13px] font-semibold text-portal-purple-text">
              <MaterialIcon name="show_chart" size={16} />
              {populatedSteps.length}{' '}
              {populatedSteps.length === 1 ? 'Cost Item' : 'Cost Items'}
            </span>
          </div>
          {addingCostItems ? (
            <div className="mt-6 border-t border-portal-border pt-6">
              <CostItemsDraftForm
                key={`${activeTab.entityId}-add`}
                phaseTypes={phaseTypes}
                blockId={block.id}
                entityId={activeTab.entityId}
                entityCode={activeTab.entityCode}
                minePhaseLimit={estimation.phaseLimit}
                electrificationPercent={
                  resolveElectrificationPercentForEntity(
                    scopedEstimation.electrificationPercentByEntity ?? {},
                    activeTab,
                    tabs,
                  )
                }
                onSubmit={handleSaveSteps}
                onCancel={() => setAddingCostItems(false)}
              />
            </div>
          ) : null}
        </>
      ) : activeTab ? (
        <CostItemsDraftForm
          key={activeTab.entityId}
          phaseTypes={phaseTypes}
          blockId={block.id}
          entityId={activeTab.entityId}
          entityCode={activeTab.entityCode}
          minePhaseLimit={scopedEstimation.phaseLimit}
          electrificationPercent={
            resolveElectrificationPercentForEntity(
              scopedEstimation.electrificationPercentByEntity ?? {},
              activeTab,
              tabs,
            )
          }
          onSubmit={handleSaveSteps}
        />
      ) : null}

      <ConfirmDeleteModal
        open={Boolean(pendingDelete)}
        title={deleteModal.title}
        message={deleteModal.message}
        deleting={deleting}
        onCancel={() => !deleting && setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      <Modal
        open={Boolean(saveError)}
        title={
          saveError?.toLowerCase().includes('phase values must sum')
            ? 'Phase amount mismatch'
            : saveError?.toLowerCase().includes('electrification')
              ? 'Design / electrification required'
              : 'Unable to save'
        }
        onClose={() => setSaveError(null)}
        backdropClassName="bg-black/30 backdrop-blur-sm"
        className="max-w-md"
        footer={
          <Button variant="primary" onClick={() => setSaveError(null)}>
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
          <p className="whitespace-pre-wrap">{saveError}</p>
        </div>
      </Modal>
    </article>
  )
}

export function CostItemsTable({
  items,
  phaseTypes,
  mineId,
  mineName,
  functionMasterId,
  functionName,
  functionInvestmentTypeId,
  includeLegacyNullFit,
  onEdit,
  onDelete,
  onChanged,
  onItemUpdated,
}: {
  items: Estimation[]
  phaseTypes: PhaseTypeMaster[]
  /** When set, only this mine's estimation card is shown. */
  mineId?: string | null
  mineName?: string | null
  functionMasterId?: string | null
  functionName?: string | null
  functionInvestmentTypeId?: string | null
  includeLegacyNullFit?: boolean
  onEdit: (estimationId: string, entityId: string) => void
  onDelete: (estimationId: string) => void | Promise<void>
  onChanged: () => void | Promise<void>
  onItemUpdated: (estimation: Estimation) => void
}) {
  const saved = items.filter((e) => Boolean(e.id))
  const nameKey = (mineName || '').trim().toLowerCase()
  const mineScoped = mineId?.trim()
    ? saved.filter(
        (e) =>
          e.id === mineId ||
          e.mine_id === mineId ||
          (nameKey
            ? (e.siteSubtitle || '').trim().toLowerCase() === nameKey
            : false),
      )
    : saved

  if (mineScoped.length === 0) {
    return (
      <div className="rounded-card bg-white px-6 py-10 text-center">
        <p className="text-sm text-gray-500">
          No submitted cost items yet for this mine. Click &quot;+ Add New Cost
          Estimation&quot; to begin.
        </p>
      </div>
    )
  }

  return (
    <div>
      {mineScoped.map((estimation) => (
        <EstimationTableCard
          key={estimation.id}
          estimation={estimation}
          phaseTypes={phaseTypes}
          functionMasterId={functionMasterId}
          functionName={functionName}
          functionInvestmentTypeId={functionInvestmentTypeId}
          includeLegacyNullFit={includeLegacyNullFit}
          onEdit={onEdit}
          onDelete={onDelete}
          onChanged={onChanged}
          onItemUpdated={onItemUpdated}
        />
      ))}
    </div>
  )
}
