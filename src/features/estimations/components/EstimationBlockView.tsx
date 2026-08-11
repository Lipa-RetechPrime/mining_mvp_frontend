import { useState } from 'react'
import { EntityTabs } from './EntityTabs'
import { EstimationBlockHeader } from './EstimationBlockHeader'
import { MinePhaseLimitInput } from './MinePhaseLimitInput'
import { ElectrificationPercentInput } from './ElectrificationPercentInput'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { PhaseGrid } from './PhaseGrid'
import { StepDetailsRow } from './StepDetailsRow'
import { CardFooter } from './FormFooter'
import { isStepPopulated } from '../api/investments'
import { useEstimationDispatch, useEstimationState } from '../context/EstimationContext'
import { useToast } from '../context/ToastContext'
import { hasAnyPhaseBlock } from '../utils/validation'
import {
  isAdhocOutsourcing,
  isFullOutsourcing,
  isPartialOutsourcing,
  useOutsourcingPartial,
} from '@/features/projects/OutsourcingPartialContext'
import type { EstimationBlock as Block, Phase, Step } from '../types/estimation'

function StepSection({
  blockId,
  entityId,
  step,
  stepNumber,
  minePhaseLimit,
  collapsed,
  onToggleCollapse,
  onRequestRemove,
}: {
  blockId: string
  entityId: string
  step: Step
  stepNumber: number
  minePhaseLimit: number | null | undefined
  collapsed: boolean
  onToggleCollapse: () => void
  onRequestRemove: () => void
}) {
  const { errors } = useEstimationState()
  const dispatch = useEstimationDispatch()
  const stepErrPrefix = `${blockId}.${entityId}.${step.id}`
  const stepErrors: Record<string, string> = {}
  for (const [k, v] of Object.entries(errors)) {
    if (k.startsWith(`${stepErrPrefix}.`)) {
      stepErrors[k.slice(stepErrPrefix.length + 1)] = v
    }
  }

  return (
    <section className="border-b border-portal-border pb-8 last:border-b-0 last:pb-0">
      <StepDetailsRow
        step={step}
        stepNumber={stepNumber}
        errors={stepErrors}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onChange={(field, value) =>
          dispatch({
            type: 'UPDATE_STEP_FIELD',
            blockId,
            entityId,
            stepId: step.id,
            field,
            value,
          })
        }
        onLabelChange={(key, value) =>
          dispatch({
            type: 'UPDATE_STEP_FIELD_LABEL',
            blockId,
            entityId,
            stepId: step.id,
            key,
            value,
          })
        }
        onAmountModeChange={(amountMode) =>
          dispatch({
            type: 'SET_STEP_AMOUNT_MODE',
            blockId,
            entityId,
            stepId: step.id,
            amountMode,
          })
        }
        onUnitCostModeChange={(unitCostMode) =>
          dispatch({
            type: 'SET_STEP_UNIT_COST_MODE',
            blockId,
            entityId,
            stepId: step.id,
            unitCostMode,
          })
        }
        onBlurRecompute={() =>
          dispatch({
            type: 'RECOMPUTE_STEP',
            blockId,
            entityId,
            stepId: step.id,
          })
        }
        onRemove={onRequestRemove}
      />
      {!collapsed ? (
        <PhaseGrid
          step={step}
          errorPrefix={stepErrPrefix}
          errors={errors}
          minePhaseLimit={minePhaseLimit}
          onChangePhase={(phaseId, patch) =>
            dispatch({
              type: 'UPDATE_PHASE',
              blockId,
              entityId,
              stepId: step.id,
              phaseId,
              patch: patch as Partial<Phase>,
            })
          }
          onAddPhase={(count) =>
            dispatch({
              type: 'ADD_PHASE',
              blockId,
              entityId,
              stepId: step.id,
              count,
            })
          }
          onRemovePhase={(phaseId) =>
            dispatch({
              type: 'REMOVE_PHASE',
              blockId,
              entityId,
              stepId: step.id,
              phaseId,
            })
          }
        />
      ) : null}
    </section>
  )
}

export function EstimationBlockView({
  block,
  appendixLabel,
  siteSubtitle,
  sectorDisplayName,
  showSubmit,
  onSubmit,
  onCancel,
  submitting,
  isEditing,
}: {
  block: Block
  appendixLabel: string
  siteSubtitle: string
  /** Prefer nav / mine-wise function name when block.sectorName is a placeholder. */
  sectorDisplayName?: string | null
  showSubmit?: boolean
  onSubmit?: () => void
  onCancel?: () => void
  submitting?: boolean
  isEditing?: boolean
}) {
  const dispatch = useEstimationDispatch()
  const { estimation, errors } = useEstimationState()
  const { success } = useToast()
  const outsourcing = useOutsourcingPartial()
  const phaseValidationMode = isFullOutsourcing(outsourcing)
    ? 'full'
    : isAdhocOutsourcing(outsourcing)
      ? 'adhoc'
      : isPartialOutsourcing(outsourcing)
        ? 'partial'
        : 'strict'
  const tab =
    block.entityTabs.find((t) => t.entityId === block.activeEntityId) ?? block.entityTabs[0]
  const showElectrificationInput = hasAnyPhaseBlock(tab?.steps ?? [], {
    phaseValidationMode,
    fullOutsourcing: isFullOutsourcing(outsourcing)
      ? {
          paybackStartPhase: outsourcing.paybackStartPhase,
          paybackPeriodYears: outsourcing.paybackPeriodYears,
          escalationPercent: outsourcing.escalationPercent,
        }
      : null,
  })
  const headerName = (() => {
    const fromNav = sectorDisplayName?.trim() || ''
    if (fromNav) return fromNav
    const fromBlock = block.sectorName?.trim() || ''
    if (fromBlock && fromBlock.toLowerCase() !== 'cost function') return fromBlock
    return fromBlock || 'Cost function'
  })()
  const [collapsedById, setCollapsedById] = useState<Record<string, boolean>>({})
  const [pendingRemove, setPendingRemove] = useState<{
    stepId: string
    stepNumber: number
    details: string
  } | null>(null)
  const steps = tab?.steps ?? []
  const stepIds = steps.map((step) => step.id)
  const scopeKey = tab ? `${block.id}:${tab.entityId}` : block.id
  const [scope, setScope] = useState<string | null>(null)
  const [knownStepIds, setKnownStepIds] = useState(() => new Set<string>())

  // Expand empty / newly added cost items; keep populated ones collapsed by default.
  if (scopeKey !== scope) {
    setScope(scopeKey)
    setKnownStepIds(new Set(stepIds))
    const expands: Record<string, boolean> = {}
    for (const step of steps) {
      if (!isStepPopulated(step)) expands[step.id] = false
    }
    if (Object.keys(expands).length > 0) {
      setCollapsedById((prev) => ({ ...prev, ...expands }))
    }
  } else {
    const added = stepIds.filter((id) => !knownStepIds.has(id))
    if (added.length > 0) {
      setKnownStepIds(new Set(stepIds))
      setCollapsedById((prev) => {
        const next = { ...prev }
        for (const id of added) next[id] = false
        return next
      })
    } else if (
      stepIds.length !== knownStepIds.size ||
      stepIds.some((id) => !knownStepIds.has(id))
    ) {
      setKnownStepIds(new Set(stepIds))
    }
  }

  if (!tab) return null

  function isStepCollapsed(stepId: string): boolean {
    // Default collapsed unless the user has explicitly expanded the item.
    return collapsedById[stepId] !== false
  }

  function toggleStepCollapse(stepId: string) {
    setCollapsedById((prev) => ({
      ...prev,
      [stepId]: prev[stepId] === false,
    }))
  }

  function handleAddStep() {
    if (submitting) return
    dispatch({ type: 'ADD_STEP', blockId: block.id, entityId: tab.entityId })
  }

  function handleConfirmRemove() {
    if (!pendingRemove) return
    dispatch({
      type: 'REMOVE_STEP',
      blockId: block.id,
      entityId: tab.entityId,
      stepId: pendingRemove.stepId,
    })
    success(`Cost Item ${pendingRemove.stepNumber} removed`)
    setPendingRemove(null)
  }

  return (
    <article className="mb-5 rounded-card bg-white px-6 py-7 sm:px-8 sm:py-8">
      <EstimationBlockHeader
        sectorName={headerName}
        appendixLabel={appendixLabel}
        siteSubtitle={siteSubtitle}
      />
      <MinePhaseLimitInput
        value={estimation.phaseLimit}
        error={errors.phaseLimit}
        readOnly={Boolean(isEditing)}
        onChange={(phaseLimit) => dispatch({ type: 'SET_MINE_PHASE_LIMIT', phaseLimit })}
      />
      <EntityTabs
        tabs={block.entityTabs.map((t) => ({ id: t.entityId, code: t.entityCode }))}
        activeId={block.activeEntityId}
        onChange={(entityId) =>
          dispatch({ type: 'SET_ACTIVE_ENTITY', blockId: block.id, entityId })
        }
      />
      
      <div className="mt-2 flex flex-col gap-8">
        {tab.steps.map((step, index) => (
          <StepSection
            key={step.id}
            blockId={block.id}
            entityId={tab.entityId}
            step={step}
            stepNumber={index + 1}
            minePhaseLimit={estimation.phaseLimit}
            collapsed={isStepCollapsed(step.id)}
            onToggleCollapse={() => toggleStepCollapse(step.id)}
            onRequestRemove={() =>
              setPendingRemove({
                stepId: step.id,
                stepNumber: index + 1,
                details: step.details?.trim() || 'Untitled Cost Item',
              })
            }
          />
        ))}
      </div>
      {showElectrificationInput ? (
        <div className="mt-4">
          <ElectrificationPercentInput
            key={`elec-${tab.entityId}-${tab.steps.filter(isStepPopulated).length}`}
            value={
              tab.steps.some(isStepPopulated)
                ? estimation.electrificationPercentByEntity?.[tab.entityId]
                : null
            }
            error={errors[`electrificationPercent.${tab.entityId}`]}
            entityCode={tab.entityCode}
            onChange={(percent) =>
              dispatch({
                type: 'SET_ELECTRIFICATION_PERCENT',
                entityId: tab.entityId,
                percent,
              })
            }
          />
        </div>
      ) : null}
      <CardFooter
        stepCount={tab.steps.length}
        showSubmit={showSubmit}
        submitting={submitting}
        isEditing={isEditing}
        onSubmit={onSubmit}
        onCancel={onCancel}
        onAddStep={handleAddStep}
      />

      <ConfirmDeleteModal
        open={Boolean(pendingRemove)}
        title="Delete cost item?"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold text-[--color-portal-navy]">
              {pendingRemove?.details ?? 'Untitled Cost Item'}
            </span>
            ? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        onCancel={() => setPendingRemove(null)}
        onConfirm={handleConfirmRemove}
      />
    </article>
  )
}
