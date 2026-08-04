import { Button } from '@/shared/components/ui/Button'
import { PhaseCard } from './PhaseCard'
import {
  PHASE_ADD_BATCH_SIZE,
  canAddPhase,
  nextPhaseBatchCount,
} from '../phases/phaseTypes'
import { phaseAmountSumError } from '../utils/validation'
import type { Phase, Step } from '../types/estimation'

export function PhaseGrid({
  step,
  errorPrefix,
  errors,
  minePhaseLimit,
  onChangePhase,
  onAddPhase,
  onRemovePhase,
}: {
  step: Step
  errorPrefix: string
  errors: Record<string, string>
  /** Mine-level max phases; drives add-phase limits for this cost item. */
  minePhaseLimit: number | null | undefined
  onChangePhase: (phaseId: string, patch: Partial<Phase>) => void
  /** Append the next batch of hardcoded phases (up to 8, never past the max). */
  onAddPhase: () => void
  onRemovePhase: (phaseId: string) => void
}) {
  const phaseLimit = minePhaseLimit ?? step.phaseLimit ?? null
  const canAddMore = canAddPhase(step.phases.length, phaseLimit)
  const remaining =
    phaseLimit != null ? Math.max(0, Math.floor(phaseLimit) - step.phases.length) : 0
  const addCount = nextPhaseBatchCount(step.phases.length, phaseLimit)
  const sumError =
    phaseAmountSumError(step) ?? errors[`${errorPrefix}.phaseAmountSum`] ?? null
  const overLimitError = errors[`${errorPrefix}.phaseLimit`] ?? null
  const limitMissing = phaseLimit == null
  const canRemovePhase = step.phases.length > 0

  return (
    <section>
      <div className="mb-4">
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold text-[--color-portal-navy]">Phasing of Investment</h4>
          <p className="mt-1 text-sm font-normal text-[--text-color]">
            Allocate cash flows across phases. Add up to {PHASE_ADD_BATCH_SIZE} phases at a time,
            never more than the mine life.
          </p>
          {sumError ? (
            <p className="mt-1.5 text-sm text-red-600" role="alert">
              {sumError}
            </p>
          ) : null}
          {overLimitError ? (
            <p className="mt-1.5 text-sm text-red-600" role="alert">
              {overLimitError}
            </p>
          ) : null}
          {limitMissing ? (
            <p className="mt-1.5 text-sm text-amber-700" role="status">
              Set the maximum number of phases above the ECL/MDO tabs before adding phases.
            </p>
          ) : null}
        </div>
      </div>

      {phaseLimit != null ? (
        <p className="mb-3 text-xs text-[--text-color]">
          Using {step.phases.length} of {phaseLimit} phases
          {remaining > 0 ? ` · ${remaining} remaining` : ' · limit reached'}
        </p>
      ) : null}

      {step.phases.length > 0 ? (
        <div className="flex flex-wrap gap-4">
          {step.phases.map((phase) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              stepAmount={step.amount ?? 0}
              errors={{
                percentage: errors[`${errorPrefix}.${phase.id}.percentage`] ?? '',
                value: errors[`${errorPrefix}.${phase.id}.value`] ?? '',
              }}
              onChange={(patch) => onChangePhase(phase.id, patch)}
              canRemove={canRemovePhase}
              onRemove={() => onRemovePhase(phase.id)}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end border-t border-[#E5E7EB] pt-4">
        <Button
          variant="secondary"
          disabled={!canAddMore || addCount <= 0}
          onClick={onAddPhase}
          title={
            limitMissing
              ? 'Set the mine phase limit first'
              : canAddMore && addCount > 0
                ? `Add ${addCount} phase${addCount === 1 ? '' : 's'}`
                : 'Phase limit reached — cannot add more'
          }
        >
          {canAddMore && addCount > 0
            ? `+ Add ${addCount} phase${addCount === 1 ? '' : 's'}`
            : `+ Add phases (limit reached)`}
        </Button>
      </div>
    </section>
  )
}
