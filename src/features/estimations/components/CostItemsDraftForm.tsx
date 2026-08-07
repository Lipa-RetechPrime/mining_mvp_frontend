import { useState } from 'react'
import { Button } from '@/shared/components/ui/Button'
import { Modal } from '@/shared/components/ui/Modal'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { StepDetailsRow } from './StepDetailsRow'
import { PhaseGrid } from './PhaseGrid'
import { CardFooter } from './FormFooter'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { ElectrificationPercentInput } from './ElectrificationPercentInput'
import { createEmptyPhase, createEmptyStep } from '../utils/factories'
import { computeAmount, computeAutomaticValue } from '../calculations/calculations'
import { applyPhasePatch } from '../phases/phasePatch'
import {
  appendTypedPhaseBatch,
  clampPhasesToLimit,
  nextPhaseBatchCount,
} from '../phases/phaseTypes'
import { isValid, validateStep } from '../utils/validation'
import { useToast } from '../context/ToastContext'
import {
  isAdhocOutsourcing,
  isFullOutsourcing,
  isPartialOutsourcing,
  useOutsourcingPartial,
} from '@/features/projects/OutsourcingPartialContext'
import type { FieldErrors, PhaseTypeMaster, Step } from '../types/estimation'

function recomputeStep(step: Step): Step {
  if (step.amountMode === 'manual') return step
  const unitCost = step.unitCostMode === 'on_hire' ? 0 : step.unitCost
  const amount = computeAmount(step.qrts, unitCost)
  return {
    ...step,
    unitCost: step.unitCostMode === 'on_hire' ? 0 : step.unitCost,
    amount,
    phases: step.phases.map((phase) => {
      if (phase.calculationMode === 'automatic' && phase.percentage !== null) {
        return { ...phase, value: computeAutomaticValue(amount, phase.percentage) }
      }
      return phase
    }),
  }
}

function patchStepField(
  step: Step,
  field: 'title' | 'details' | 'manpower' | 'qrts' | 'unitCost' | 'amount',
  value: string,
): Step {
  if (field === 'details' || field === 'title') return { ...step, [field]: value }
  const raw = value.trim()
  return { ...step, [field]: raw === '' ? null : Number(raw) }
}

function updateStep(steps: Step[], stepId: string, updater: (step: Step) => Step): Step[] {
  return steps.map((step) => (step.id === stepId ? updater(step) : step))
}

function clearErrors(errors: FieldErrors, keys: string[]): FieldErrors {
  if (!keys.some((key) => key in errors)) return errors
  const next = { ...errors }
  for (const key of keys) delete next[key]
  return next
}

function createDraftStep(
  minePhaseLimit: number | null | undefined,
  title = 'Cost Item 1',
): Step {
  const step = createEmptyStep(title)
  if (minePhaseLimit == null || minePhaseLimit <= 0) return step
  return {
    ...step,
    phaseLimit: Math.floor(minePhaseLimit),
    // Empty until the user clicks Add phases.
    phases: [],
  }
}

function createExpandedDraft(
  minePhaseLimit: number | null | undefined,
  title?: string,
): { step: Step; collapsedById: Record<string, boolean> } {
  const step = createDraftStep(minePhaseLimit, title)
  return { step, collapsedById: { [step.id]: false } }
}

/**
 * Multi cost-item draft form.
 * "+ Add Cost Item" only appends another empty form.
 * "Submit" validates and returns all cost items.
 */
export function CostItemsDraftForm({
  phaseTypes: _phaseTypes,
  blockId,
  entityId,
  entityCode,
  minePhaseLimit,
  electrificationPercent,
  onSubmit,
  onCancel,
}: {
  phaseTypes: PhaseTypeMaster[]
  blockId: string
  entityId: string
  entityCode?: string
  minePhaseLimit: number | null | undefined
  /** Saved design % for this entity — used on submit if the input is left blank; never shown as a default. */
  electrificationPercent?: number | null
  onSubmit: (
    steps: Step[],
    electrificationPercent: number | null,
  ) => Promise<void> | void
  onCancel?: () => void
}) {
  void _phaseTypes
  const { success } = useToast()
  const outsourcing = useOutsourcingPartial()
  const phaseValidationMode = isFullOutsourcing(outsourcing)
    ? 'full'
    : isAdhocOutsourcing(outsourcing)
      ? 'adhoc'
      : isPartialOutsourcing(outsourcing)
        ? 'partial'
        : 'strict'
  const [initialDraft] = useState(() => createExpandedDraft(minePhaseLimit))
  const [steps, setSteps] = useState<Step[]>([initialDraft.step])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  // false = expanded. New empty drafts set false; missing keys stay collapsed.
  const [collapsedById, setCollapsedById] = useState<Record<string, boolean>>(
    initialDraft.collapsedById,
  )
  // Always start blank — do not copy a previously saved entity %.
  // On submit, fall back to a saved entity % only if the field is left empty.
  const [percent, setPercent] = useState<number | null>(null)
  const [validationPopup, setValidationPopup] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<{
    stepId: string
    stepNumber: number
    details: string
  } | null>(null)

  const [prevEntityId, setPrevEntityId] = useState(entityId)
  if (entityId !== prevEntityId) {
    setPrevEntityId(entityId)
    setPercent(null)
  }

  const [prevMinePhaseLimit, setPrevMinePhaseLimit] = useState(minePhaseLimit)
  if (minePhaseLimit !== prevMinePhaseLimit) {
    setPrevMinePhaseLimit(minePhaseLimit)
    setSteps((prev) =>
      prev.map((step) => {
        if (minePhaseLimit == null || minePhaseLimit <= 0) {
          return { ...step, phaseLimit: null }
        }
        const limit = Math.floor(minePhaseLimit)
        return {
          ...step,
          phaseLimit: limit,
          phases: clampPhasesToLimit(step.phases, limit),
        }
      }),
    )
  }

  async function handleSubmit() {
    const prepared = steps.map(recomputeStep)
    const nextErrors: FieldErrors = {}
    for (const step of prepared) {
      validateStep(step, nextErrors, blockId, entityId, minePhaseLimit, {
        phaseValidationMode,
      })
    }
    const savedPercent =
      electrificationPercent != null && Number.isFinite(electrificationPercent)
        ? electrificationPercent
        : null
    const effectivePercent =
      percent != null && Number.isFinite(percent) && percent >= 0
        ? percent
        : savedPercent
    if (effectivePercent == null || effectivePercent < 0) {
      nextErrors[`electrificationPercent.${entityId}`] =
        `Design / electrification percent is required for ${entityCode ?? 'this entity'}`
    }
    setErrors(nextErrors)
    if (!isValid(nextErrors)) {
      const sumMessages = Object.entries(nextErrors)
        .filter(
          ([key]) =>
            key.endsWith('.phaseAmountSum') || key === 'phaseAmountSum',
        )
        .map(([, message]) => message)
      const percentMessages = Object.entries(nextErrors)
        .filter(([key]) => key.startsWith('electrificationPercent.'))
        .map(([, message]) => message)
      const messages = [...percentMessages, ...sumMessages]
      if (messages.length > 0) {
        setValidationPopup(messages.join('\n'))
      }
      return
    }
    setValidationPopup(null)
    setSaving(true)
    try {
      await onSubmit(prepared, effectivePercent)
      const next = createExpandedDraft(minePhaseLimit)
      setSteps([next.step])
      setPercent(null)
      setErrors({})
      setCollapsedById(next.collapsedById)
    } finally {
      setSaving(false)
    }
  }

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

  function handleConfirmRemove() {
    if (!pendingRemove) return
    const { stepId, stepNumber } = pendingRemove
    if (steps.length <= 1) {
      const next = createExpandedDraft(minePhaseLimit)
      setSteps([next.step])
      setCollapsedById(next.collapsedById)
    } else {
      setSteps((prev) => prev.filter((s) => s.id !== stepId))
      setCollapsedById((prev) => {
        const next = { ...prev }
        delete next[stepId]
        return next
      })
    }
    success(`Cost Item ${stepNumber} removed`)
    setPendingRemove(null)
  }

  return (
    <div>
     
      <div className="mt-2 flex flex-col gap-8">
        {steps.map((step, index) => {
          const errorPrefix = `${blockId}.${entityId}.${step.id}`
          const stepErrors: Record<string, string> = {}
          for (const [k, v] of Object.entries(errors)) {
            if (k.startsWith(`${errorPrefix}.`)) {
              stepErrors[k.slice(errorPrefix.length + 1)] = v
            }
          }
          const collapsed = isStepCollapsed(step.id)
          return (
            <section
              key={step.id}
              className="border-b border-portal-border pb-8 last:border-b-0 last:pb-0"
            >
              <StepDetailsRow
                step={step}
                stepNumber={index + 1}
                errors={stepErrors}
                collapsed={collapsed}
                onToggleCollapse={() => toggleStepCollapse(step.id)}
                onChange={(field, value) => {
                  setSteps((prev) =>
                    updateStep(prev, step.id, (s) => patchStepField(s, field, value)),
                  )
                  setErrors((prev) =>
                    clearErrors(prev, [
                      `${errorPrefix}.${field}`,
                      ...(field === 'amount' || field === 'qrts' || field === 'unitCost'
                        ? [`${errorPrefix}.phaseAmountSum`]
                        : []),
                    ]),
                  )
                }}
                onLabelChange={(key, value) =>
                  setSteps((prev) =>
                    updateStep(prev, step.id, (s) => ({
                      ...s,
                      fieldLabels: { ...s.fieldLabels, [key]: value },
                    })),
                  )
                }
                onAmountModeChange={(amountMode) =>
                  setSteps((prev) =>
                    updateStep(prev, step.id, (s) => recomputeStep({ ...s, amountMode })),
                  )
                }
                onUnitCostModeChange={(unitCostMode) =>
                  setSteps((prev) =>
                    updateStep(prev, step.id, (s) =>
                      recomputeStep({
                        ...s,
                        unitCostMode,
                        unitCost: unitCostMode === 'on_hire' ? 0 : s.unitCost,
                      }),
                    ),
                  )
                }
                onBlurRecompute={() => setSteps((prev) => updateStep(prev, step.id, recomputeStep))}
                onRemove={() =>
                  setPendingRemove({
                    stepId: step.id,
                    stepNumber: index + 1,
                    details: step.details?.trim() || 'Untitled Cost Item',
                  })
                }
              />
              {!collapsed ? (
                <PhaseGrid
                  step={step}
                  errorPrefix={errorPrefix}
                  errors={errors}
                  minePhaseLimit={minePhaseLimit}
                  onChangePhase={(phaseId, patch) => {
                    setSteps((prev) =>
                      updateStep(prev, step.id, (s) => ({
                        ...s,
                        phases: s.phases.map((phase) =>
                          phase.id === phaseId ? applyPhasePatch(phase, patch, s.amount ?? 0) : phase,
                        ),
                      })),
                    )
                    setErrors((prev) =>
                      clearErrors(prev, [
                        ...Object.keys(patch).map((field) => `${errorPrefix}.${phaseId}.${field}`),
                        `${errorPrefix}.phaseAmountSum`,
                      ]),
                    )
                  }}
                  onAddPhase={() =>
                    setSteps((prev) =>
                      updateStep(prev, step.id, (s) => {
                        const limit = minePhaseLimit ?? s.phaseLimit
                        if (limit == null) return s
                        const count = nextPhaseBatchCount(s.phases.length, limit)
                        if (count <= 0) return s
                        return {
                          ...s,
                          phaseLimit: limit,
                          phases: clampPhasesToLimit(
                            appendTypedPhaseBatch(s.phases, count, createEmptyPhase),
                            limit,
                          ),
                        }
                      }),
                    )
                  }
                  onRemovePhase={(phaseId) =>
                    setSteps((prev) =>
                      updateStep(prev, step.id, (s) => ({
                        ...s,
                        phases: s.phases.filter((phase) => phase.id !== phaseId),
                      })),
                    )
                  }
                />
              ) : null}
            </section>
          )
        })}
      </div>
      <ElectrificationPercentInput
        value={percent}
        entityCode={entityCode}
        error={errors[`electrificationPercent.${entityId}`]}
        onChange={(value) => {
          setPercent(value)
          setErrors((prev) => clearErrors(prev, [`electrificationPercent.${entityId}`]))
        }}
      />

      <CardFooter
        stepCount={steps.length}
        showSubmit
        submitting={saving}
        isEditing={false}
        onCancel={onCancel}
        onAddStep={() => {
          if (!saving) {
            const next = createExpandedDraft(
              minePhaseLimit,
              `Cost Item ${steps.length + 1}`,
            )
            setSteps((prev) => [...prev, next.step])
            setCollapsedById((prev) => ({ ...prev, ...next.collapsedById }))
          }
        }}
        onSubmit={() => void handleSubmit()}
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

      <Modal
        open={Boolean(validationPopup)}
        title={
          validationPopup?.toLowerCase().includes('phase values must sum')
            ? 'Phase amount mismatch'
            : 'Unable to save cost item'
        }
        onClose={() => setValidationPopup(null)}
        backdropClassName="bg-black/30 backdrop-blur-sm"
        className="max-w-md"
        footer={
          <Button variant="primary" onClick={() => setValidationPopup(null)}>
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
          <p className="whitespace-pre-wrap">{validationPopup}</p>
        </div>
      </Modal>
    </div>
  )
}
