import { phaseValuesSumToAmount, resolvePhaseValue } from '../calculations/calculations'
import { formatAmount } from './formatAmount'
import { DEFAULT_INITIAL_PHASE_COUNT } from '../phases/phaseTypes'
import { isStepPopulated } from '../api/investments/domain'
import type { Estimation, EstimationBlock, FieldErrors, Phase, Step } from '../types/estimation'

function stepKey(blockId: string, entityId: string, stepId: string, field: string) {
  return `${blockId}.${entityId}.${stepId}.${field}`
}

/** A phase counts toward the amount sum only once the user entered a value/%. */
export function phaseHasEnteredValue(phase: Phase): boolean {
  if (phase.calculationMode === 'manual') {
    return phase.value !== null && !Number.isNaN(phase.value)
  }
  return phase.percentage !== null && !Number.isNaN(phase.percentage)
}

/**
 * Ownership (`strict`) and Partial: filled origin phase values must sum to Amount
 * (Partial: before contribution%; contributor readout is display-only).
 * Full: no phase entry required.
 * Adhoc: phases are manual only; values are not required to sum to Amount.
 */
export type PhaseValidationMode = 'strict' | 'partial' | 'full' | 'adhoc'

export type EstimationValidationOptions = {
  phaseValidationMode?: PhaseValidationMode
  /** @deprecated Prefer phaseValidationMode: 'full' */
  skipPhaseAmountValidation?: boolean
}

function resolvePhaseValidationMode(
  options?: EstimationValidationOptions,
): PhaseValidationMode {
  if (options?.phaseValidationMode) return options.phaseValidationMode
  if (options?.skipPhaseAmountValidation) return 'full'
  return 'strict'
}

/** Populated cost items need at least one phase with a value; filled phases must sum to Amount (strict / partial). */
export function phaseAmountSumError(
  step: Step,
  mode: PhaseValidationMode = 'strict',
): string | null {
  if (mode === 'full') return null

  const filled = step.phases.filter(phaseHasEnteredValue)

  if (filled.length === 0) {
    if (!isStepPopulated(step)) return null
    if (step.phases.length === 0) {
      return 'Add at least one phase block and enter a value.'
    }
    return 'Enter a value in at least one phase.'
  }

  // Adhoc: enter phase values freely; do not require sum to Amount.
  if (mode === 'adhoc') return null

  // Ownership + Partial: origin phase values (manual value or Amount × %) must equal Amount.
  if (phaseValuesSumToAmount(filled, step.amount ?? 0)) return null
  const sum = filled.reduce(
    (acc, phase) => acc + resolvePhaseValue(phase, step.amount ?? 0),
    0,
  )
  return `Phase values must sum to Amount (${formatAmount(step.amount ?? 0)}); current sum is ${formatAmount(sum)}`
}

export function validateStep(
  step: Step,
  errors: FieldErrors,
  blockId: string,
  entityId: string,
  minePhaseLimit?: number | null,
  options?: EstimationValidationOptions,
): void {
  if (!step.details.trim()) {
    errors[stepKey(blockId, entityId, step.id, 'details')] = 'Details are required'
  }
  for (const field of ['manpower', 'qrts', 'unitCost'] as const) {
    const v = step[field]
    if (v === null || v === undefined || Number.isNaN(v) || v < 0) {
      errors[stepKey(blockId, entityId, step.id, field)] = 'Enter a valid non-negative number'
    }
  }
  if (step.amount == null || !Number.isFinite(step.amount) || step.amount < 0) {
    errors[stepKey(blockId, entityId, step.id, 'amount')] =
      'Enter a valid non-negative amount'
  }
  const limit = minePhaseLimit ?? step.phaseLimit
  if (limit != null && limit > 0 && step.phases.length > limit) {
    errors[stepKey(blockId, entityId, step.id, 'phaseLimit')] =
      `This cost item has ${step.phases.length} phases; maximum allowed is ${limit}`
  }
  if (isStepPopulated(step)) {
    const sumError = phaseAmountSumError(step, resolvePhaseValidationMode(options))
    if (sumError) {
      errors[stepKey(blockId, entityId, step.id, 'phaseAmountSum')] = sumError
    }
  }
}

export function validateBlock(
  block: EstimationBlock,
  errors: FieldErrors,
  minePhaseLimit?: number | null,
  options?: EstimationValidationOptions,
): void {
  if (!block.sectorName.trim()) {
    errors[`${block.id}.sectorName`] = 'Sector is required'
  }
  if (!block.activeEntityId && block.entityTabs.length > 0) {
    errors[`${block.id}.activeEntityId`] = 'Select an entity'
  }
  const activeTab = block.entityTabs.find((t) => t.entityId === block.activeEntityId)
  if (activeTab) {
    if (activeTab.steps.length === 0) {
      errors[`${block.id}.${activeTab.entityId}.steps`] = 'Add at least one step'
    }
    for (const step of activeTab.steps) {
      validateStep(step, errors, block.id, activeTab.entityId, minePhaseLimit, options)
    }
  }
}

export function validateEstimation(
  estimation: Estimation,
  options?: EstimationValidationOptions,
): FieldErrors {
  const errors: FieldErrors = {}
  if (
    estimation.phaseLimit == null ||
    !Number.isFinite(estimation.phaseLimit) ||
    estimation.phaseLimit < DEFAULT_INITIAL_PHASE_COUNT
  ) {
    errors.phaseLimit = `Enter a maximum of at least ${DEFAULT_INITIAL_PHASE_COUNT} phases for this mine`
  }

  const percentByEntity = estimation.electrificationPercentByEntity ?? {}
  for (const block of estimation.blocks) {
    for (const tab of block.entityTabs) {
      if (!tab.steps.some(isStepPopulated)) continue
      const percent =
        percentByEntity[tab.entityId] ??
        // Fallback if percent was stored under a sibling tab id for the same entity code
        Object.entries(percentByEntity).find(([key]) => {
          if (key === tab.entityId) return true
          const sibling = block.entityTabs.find((t) => t.entityId === key)
          return (
            sibling != null &&
            sibling.entityCode.trim().toLowerCase() ===
              tab.entityCode.trim().toLowerCase()
          )
        })?.[1]
      if (percent == null || !Number.isFinite(percent) || percent < 0) {
        errors[`electrificationPercent.${tab.entityId}`] =
          `Design / electrification percent is required for ${tab.entityCode}`
      }
    }
  }

  if (estimation.blocks.length === 0) {
    errors.blocks = 'Add at least one estimation'
  }
  for (const block of estimation.blocks) {
    validateBlock(block, errors, estimation.phaseLimit, options)
  }
  return errors
}

export function isValid(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0
}
