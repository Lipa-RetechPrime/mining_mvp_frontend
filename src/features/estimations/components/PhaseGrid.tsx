import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { PhaseCard } from './PhaseCard'
import {
  PHASE_ADD_BATCH_SIZE,
  canAddPhase,
  nextPhaseBatchCount,
} from '../phases/phaseTypes'
import { formatAmount } from '../utils/formatAmount'
import { phaseAmountSumError } from '../utils/validation'
import { buildFullCostItemPaybackPhases } from '@/features/projects/partialContribution'
import {
  isFullOutsourcing,
  isPartialOutsourcing,
  useOutsourcingPartial,
} from '@/features/projects/OutsourcingPartialContext'
import type { Phase, Step } from '../types/estimation'

function FullPaybackPhaseGrid({
  step,
  minePhaseLimit,
}: {
  step: Step
  minePhaseLimit: number | null | undefined
}) {
  const outsourcing = useOutsourcingPartial()
  if (!isFullOutsourcing(outsourcing)) return null

  const phaseLimit = minePhaseLimit ?? step.phaseLimit ?? null
  const phases = buildFullCostItemPaybackPhases({
    totalAmount: step.amount,
    escalationPercent: outsourcing.escalationPercent,
    paybackPeriodYears: outsourcing.paybackPeriodYears,
    paybackStartPhase: outsourcing.paybackStartPhase,
    phaseLimit,
  })

  return (
    <section>
      <div className="mb-4">
        <h4 className="text-[15px] font-semibold text-[--color-portal-navy]">
          Phasing of Investment
        </h4>
        <p className="mt-1 text-sm font-normal text-[--text-color]">
          Read-only payback phases from the configured start phase across the
          payback period. Each value is the cost-item amount split equally,
          then increased by escalation — same as the Overall sheet.
        </p>
      </div>

      {phases.length === 0 ? (
        <p className="text-sm text-amber-700" role="status">
          No payback phases can be shown for the current start phase and mine
          phase limit. Check Full contribution settings.
        </p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {phases.map((phase) => (
            <div
              key={phase.phaseType}
              className="flex min-w-0 flex-col gap-3 rounded-lg bg-white p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex h-9 w-11 shrink-0 items-center justify-center rounded-[4px] border border-[#D1D5DB] bg-[#F9FAFB] text-sm font-semibold text-[--color-portal-navy]"
                  aria-label={`Phase ${phase.phaseType}`}
                >
                  {phase.phaseType}
                </div>
                <Input
                  className="min-w-0 flex-1 basis-[10rem]"
                  type="text"
                  inputMode="decimal"
                  suffix="lakhs"
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  aria-label={`Payback phase ${phase.phaseType} value`}
                  title="Equal share of amount × (1 + escalation%)"
                  value={formatAmount(phase.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

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
  const outsourcing = useOutsourcingPartial()
  if (isFullOutsourcing(outsourcing)) {
    return <FullPaybackPhaseGrid step={step} minePhaseLimit={minePhaseLimit} />
  }

  const isPartial = isPartialOutsourcing(outsourcing)
  const phaseLimit = minePhaseLimit ?? step.phaseLimit ?? null
  const canAddMore = canAddPhase(step.phases.length, phaseLimit)
  const remaining =
    phaseLimit != null ? Math.max(0, Math.floor(phaseLimit) - step.phases.length) : 0
  const addCount = nextPhaseBatchCount(step.phases.length, phaseLimit)
  const sumError =
    phaseAmountSumError(step, isPartial ? 'partial' : 'strict') ??
    errors[`${errorPrefix}.phaseAmountSum`] ??
    null
  const overLimitError = errors[`${errorPrefix}.phaseLimit`] ?? null
  const limitMissing = phaseLimit == null
  const canRemovePhase = step.phases.length > 0

  return (
    <section>
      <div className="mb-4">
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold text-[--color-portal-navy]">Phasing of Investment</h4>
          <p className="mt-1 text-sm font-normal text-[--text-color]">
            {isPartial
              ? 'Enter phase values for the contributor share. Phase values do not need to sum to Amount — the remainder plus escalation is distributed on the Overall sheet.'
              : `Allocate cash flows across phases. Add up to ${PHASE_ADD_BATCH_SIZE} phases at a time, never more than the mine life.`}
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
