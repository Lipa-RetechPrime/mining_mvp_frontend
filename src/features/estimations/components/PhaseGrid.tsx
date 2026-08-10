import { useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { PhaseCard } from './PhaseCard'
import {
  PHASE_ADD_BATCH_SIZE,
  canAddPhase,
  nextPhaseBatchCount,
  normalizeCatalogPhaseCode,
  phaseTypeIndex,
} from '../phases/phaseTypes'
import { formatAmount } from '../utils/formatAmount'
import {
  filledPhaseCodesFromStep,
  latestFilledPhase,
  phaseAmountSumError,
} from '../utils/validation'
import {
  buildFullCostItemPaybackPhases,
  hasInsufficientPaybackRoom,
  insufficientPaybackRoomMessage,
  nextPaybackPhaseCodes,
} from '@/features/projects/partialContribution'
import { resolvePhaseCodeFromIdOrName } from '@/features/estimations/api/phases'
import {
  isAdhocOutsourcing,
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
  const isFull = isFullOutsourcing(outsourcing)
  const rawStart =
    isFull && outsourcing.paybackStartPhase
      ? outsourcing.paybackStartPhase.trim()
      : ''
  const catalogStart = normalizeCatalogPhaseCode(rawStart)
  const [resolvedStart, setResolvedStart] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setResolveError(null)

    if (!isFull || !rawStart) {
      setResolvedStart(null)
      return
    }
    if (catalogStart) {
      setResolvedStart(catalogStart)
      return
    }

    void (async () => {
      try {
        const code = await resolvePhaseCodeFromIdOrName(rawStart)
        if (cancelled) return
        setResolvedStart(normalizeCatalogPhaseCode(code) ?? code)
      } catch (error) {
        if (cancelled) return
        setResolvedStart(null)
        setResolveError(
          error instanceof Error
            ? error.message
            : 'Could not resolve payback start phase from Full contribution settings.',
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isFull, rawStart, catalogStart])

  if (!isFull || !outsourcing) return null

  const startPhase = catalogStart ?? resolvedStart
  const phaseLimit = minePhaseLimit ?? step.phaseLimit ?? null
  const paybackYears = Number(outsourcing.paybackPeriodYears)
  const escalation = Number(outsourcing.escalationPercent)

  const phases =
    startPhase &&
    Number.isFinite(paybackYears) &&
    paybackYears > 0 &&
    Number.isFinite(escalation) &&
    escalation >= 0
      ? buildFullCostItemPaybackPhases({
          totalAmount: step.amount,
          escalationPercent: escalation,
          paybackPeriodYears: paybackYears,
          paybackStartPhase: startPhase,
          phaseLimit,
        })
      : []

  const emptyReason = (() => {
    if (!rawStart) {
      return 'Full contribution is missing a payback start phase. Open Edit outsourcing configuration and select a start phase (e.g. P1).'
    }
    if (resolveError) return resolveError
    if (!startPhase) {
      return `Payback start "${rawStart}" is not a known catalog phase (C1/P1…). Re-save Full contribution settings.`
    }
    if (phaseTypeIndex(startPhase) == null) {
      return `Payback start "${startPhase}" is not a known catalog phase.`
    }
    if (!Number.isFinite(paybackYears) || paybackYears <= 0) {
      return 'Full contribution payback period years must be greater than 0.'
    }
    if (phases.length === 0) {
      return `No payback phases for start ${startPhase} under mine phase limit (${phaseLimit ?? 'unset'}). Check Full contribution settings.`
    }
    return null
  })()

  return (
    <section>
      <div className="mb-4">
        <h4 className="text-[15px] font-semibold text-[--color-portal-navy]">
          Phasing of Investment
        </h4>
      </div>

      {phases.length === 0 ? (
        <p className="text-sm text-amber-700" role="status">
          {emptyReason ??
            'No payback phases can be shown for the current start phase and mine phase limit. Check Full contribution settings.'}
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
  /** Append `count` phases (capped by mine max / Partial payback reserve). */
  onAddPhase: (count: number) => void
  onRemovePhase: (phaseId: string) => void
}) {
  const outsourcing = useOutsourcingPartial()
  if (isFullOutsourcing(outsourcing)) {
    return <FullPaybackPhaseGrid step={step} minePhaseLimit={minePhaseLimit} />
  }

  const isPartial = isPartialOutsourcing(outsourcing)
  const isAdhoc = isAdhocOutsourcing(outsourcing)
  const phaseLimit = minePhaseLimit ?? step.phaseLimit ?? null
  const paybackPeriodYears = isPartial ? outsourcing.paybackPeriodYears : null
  const remaining =
    phaseLimit != null ? Math.max(0, Math.floor(phaseLimit) - step.phases.length) : 0
  const addCount = nextPhaseBatchCount(step.phases.length, phaseLimit)
  const canAddMore = canAddPhase(step.phases.length, phaseLimit)
  const phaseValidationMode = isAdhoc
    ? 'adhoc'
    : isPartial
      ? 'partial'
      : 'strict'
  const sumError =
    phaseAmountSumError(step, phaseValidationMode) ??
    errors[`${errorPrefix}.phaseAmountSum`] ??
    null
  const overLimitError = errors[`${errorPrefix}.phaseLimit`] ?? null
  const limitMissing = phaseLimit == null
  const canRemovePhase = step.phases.length > 0

  const filledPhaseCodes = filledPhaseCodesFromStep(step)
  const lateFilledPhase = latestFilledPhase(step)
  const paybackTargetCodes =
    isPartial && paybackPeriodYears != null && paybackPeriodYears > 0
      ? nextPaybackPhaseCodes(filledPhaseCodes, paybackPeriodYears, phaseLimit)
      : []
  const paybackTargetLabel =
    paybackTargetCodes.length > 0 ? paybackTargetCodes.join(', ') : ''
  const paybackRoomMessage =
    isPartial &&
    phaseLimit != null &&
    paybackPeriodYears != null &&
    paybackPeriodYears > 0 &&
    hasInsufficientPaybackRoom({
      filledPhaseCodes,
      phaseLimit,
      paybackPeriodYears,
    })
      ? insufficientPaybackRoomMessage(phaseLimit, paybackPeriodYears)
      : null
  const paybackRoomWarning =
    paybackRoomMessage ??
    errors[`${errorPrefix}.paybackRoom`] ??
    null

  return (
    <section>
      <div className="mb-4">
        <div className="min-w-0">
          <h4 className="text-[15px] font-semibold text-[--color-portal-navy]">Phasing of Investment</h4>
          <p className="mt-1 text-sm font-normal text-[--text-color]">
            {isAdhoc
              ? 'Enter phase values manually. They do not need to sum to Amount.'
              : isPartial
                ? 'Enter origin phase values that sum to Amount. Contributor % is applied for display;  Payback amount is shown on the Overall sheet after the last filled phase.'
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
          {paybackRoomWarning ? (
            <p className="mt-1.5 text-sm text-amber-700" role="alert">
              {paybackRoomWarning}
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
          {paybackTargetLabel
            ? ` · payback on ${paybackTargetLabel}`
            : isPartial && paybackPeriodYears != null && paybackPeriodYears > 0
              ? ' · payback follows the last filled phase'
              : ''}
        </p>
      ) : null}

      {step.phases.length > 0 ? (
        <div className="flex flex-wrap gap-4">
          {step.phases.map((phase) => {
            const isLateFilled =
              Boolean(paybackRoomMessage) && lateFilledPhase?.id === phase.id
            return (
              <PhaseCard
                key={phase.id}
                phase={phase}
                stepAmount={step.amount ?? 0}
                errors={{
                  percentage:
                    errors[`${errorPrefix}.${phase.id}.percentage`] ||
                    (isLateFilled && phase.calculationMode === 'automatic'
                      ? paybackRoomMessage ?? ''
                      : ''),
                  value:
                    errors[`${errorPrefix}.${phase.id}.value`] ||
                    (isLateFilled && phase.calculationMode !== 'automatic'
                      ? paybackRoomMessage ?? ''
                      : ''),
                }}
                onChange={(patch) => onChangePhase(phase.id, patch)}
                canRemove={canRemovePhase}
                onRemove={() => onRemovePhase(phase.id)}
              />
            )
          })}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end border-t border-[#E5E7EB] pt-4">
        <Button
          variant="secondary"
          disabled={!canAddMore || addCount <= 0}
          onClick={() => {
            if (addCount > 0) onAddPhase(addCount)
          }}
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
