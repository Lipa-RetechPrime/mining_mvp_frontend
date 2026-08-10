import { phaseValuesSumToAmount, resolvePhaseValue } from '../calculations/calculations'
import { formatAmount } from './formatAmount'
import { DEFAULT_INITIAL_PHASE_COUNT } from '../phases/phaseTypes'
import { isStepPopulated } from '../api/investments/domain'
import {
  hasInsufficientPaybackRoom,
  insufficientPaybackRoomMessage,
} from '@/features/projects/partialContribution'
import { phaseTypeIndex } from '../phases/phaseTypes'
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
 * Design / electrification is shown only after at least one phase block exists
 * on any cost item (empty blocks count). Full outsourcing: amount + payback
 * settings count as phases, since payback rows are display-only until stamp.
 */
export function hasAnyPhaseBlock(
  steps: Step[],
  options?: {
    phaseValidationMode?: PhaseValidationMode
    fullOutsourcing?: {
      paybackStartPhase?: string | null
      paybackPeriodYears?: number | null
      escalationPercent?: number | null
    } | null
  },
): boolean {
  if (steps.some((step) => step.phases.length > 0)) return true

  const mode = options?.phaseValidationMode
  const full = options?.fullOutsourcing
  const isFull = mode === 'full' || full != null
  if (!isFull) return false

  const start = full?.paybackStartPhase?.trim() ?? ''
  const years = Number(full?.paybackPeriodYears)
  const escalation = Number(full?.escalationPercent)
  const settingsOk =
    full == null
      ? true
      : Boolean(start) &&
        Number.isFinite(years) &&
        years > 0 &&
        Number.isFinite(escalation) &&
        escalation >= 0
  if (!settingsOk) return false

  return steps.some(
    (step) => step.amount != null && Number.isFinite(step.amount),
  )
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
  /** Partial: years of payback after last filled phase (blocks submit if no room). */
  paybackPeriodYears?: number | null
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

/** Catalog codes for phases the user has entered (Partial payback start). */
export function filledPhaseCodesFromStep(step: Step): string[] {
  return step.phases
    .filter((phase) => phaseHasEnteredValue(phase) && phase.phaseType)
    .map((phase) => phase.phaseType as string)
}

/** Latest filled phase row (by catalog order), used to attach payback-room field errors. */
export function latestFilledPhase(step: Step): Phase | null {
  let best: Phase | null = null
  let bestIdx = -1
  for (const phase of step.phases) {
    if (!phaseHasEnteredValue(phase) || !phase.phaseType) continue
    const idx = phaseTypeIndex(phase.phaseType)
    if (idx != null && idx > bestIdx) {
      bestIdx = idx
      best = phase
    }
  }
  return best
}

/** Populated cost items need at least one phase with a value; filled phases must sum to Amount (strict / partial). */
export function phaseAmountSumError(
  step: Step,
  mode: PhaseValidationMode = 'strict',
): string | null {
  // Full: phases are stamped; no sum/entry checks here.
  if (mode === 'full') return null

  const filled = step.phases.filter(phaseHasEnteredValue)

  if (filled.length === 0) {
    if (!isStepPopulated(step)) return null
    if (step.phases.length === 0) {
      return 'Add at least one phase block and enter a value.'
    }
    return 'Enter a value in at least one phase.'
  }

  // Adhoc: free-form phase values; never require sum to Amount.
  if (mode === 'adhoc') return null

  // Ownership + Partial: origin phase values (manual value or Amount × %) must equal Amount.
  if (phaseValuesSumToAmount(filled, step.amount ?? 0)) return null
  const sum = filled.reduce(
    (acc, phase) => acc + resolvePhaseValue(phase, step.amount ?? 0),
    0,
  )
  return `Phase values must sum to Amount (${formatAmount(step.amount ?? 0)}); current sum is ${formatAmount(sum)}`
}

/** Partial: last filled phase must leave enough slots under mine limit for payback years. */
export function phasePaybackRoomError(
  step: Step,
  minePhaseLimit: number | null | undefined,
  paybackPeriodYears: number | null | undefined,
): string | null {
  const limit = minePhaseLimit ?? step.phaseLimit
  if (
    limit == null ||
    paybackPeriodYears == null ||
    !Number.isFinite(paybackPeriodYears) ||
    paybackPeriodYears <= 0
  ) {
    return null
  }
  const filled = filledPhaseCodesFromStep(step)
  if (
    !hasInsufficientPaybackRoom({
      filledPhaseCodes: filled,
      phaseLimit: limit,
      paybackPeriodYears,
    })
  ) {
    return null
  }
  return insufficientPaybackRoomMessage(limit, paybackPeriodYears)
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
  const mode = resolvePhaseValidationMode(options)
  if (isStepPopulated(step)) {
    const sumError = phaseAmountSumError(step, mode)
    if (sumError) {
      errors[stepKey(blockId, entityId, step.id, 'phaseAmountSum')] = sumError
    }
  }
  if (mode === 'partial') {
    const roomError = phasePaybackRoomError(
      step,
      minePhaseLimit,
      options?.paybackPeriodYears,
    )
    if (roomError) {
      errors[stepKey(blockId, entityId, step.id, 'paybackRoom')] = roomError
      const late = latestFilledPhase(step)
      if (late) {
        const field =
          late.calculationMode === 'automatic' ? 'percentage' : 'value'
        errors[stepKey(blockId, entityId, step.id, `${late.id}.${field}`)] =
          roomError
      }
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
  if (block.entityTabs.length === 0) return

  // Validate every entity that has cost-item data — not only the active tab.
  // Otherwise MDO phase / amount errors never reach the submit popup when ECL
  // is active (or when activeEntityId is reset to ECL after id remapping).
  const tabsToValidate = block.entityTabs.filter((tab) =>
    tab.steps.some(isStepPopulated),
  )
  const targets =
    tabsToValidate.length > 0
      ? tabsToValidate
      : block.entityTabs.filter((tab) => tab.entityId === block.activeEntityId)

  for (const tab of targets) {
    if (tab.steps.length === 0) {
      errors[`${block.id}.${tab.entityId}.steps`] = 'Add at least one step'
    }
    for (const step of tab.steps) {
      validateStep(step, errors, block.id, tab.entityId, minePhaseLimit, options)
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
  const phaseMode = resolvePhaseValidationMode(options)
  for (const block of estimation.blocks) {
    for (const tab of block.entityTabs) {
      if (!tab.steps.some(isStepPopulated)) continue
      // No phase blocks → Design % is hidden and not required.
      if (!hasAnyPhaseBlock(tab.steps, { phaseValidationMode: phaseMode })) {
        continue
      }
      const percent = resolveElectrificationPercentForEntity(
        percentByEntity,
        tab,
        block.entityTabs,
      )
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

/** Resolve design % by entity id, remapped uuid, or same entity code. */
export function resolveElectrificationPercentForEntity(
  percentByEntity: Record<string, number>,
  tab: { entityId: string; entityCode: string },
  siblings: Array<{ entityId: string; entityCode: string }> = [],
): number | null {
  const direct = percentByEntity[tab.entityId]
  if (direct != null && Number.isFinite(direct) && direct >= 0) return direct

  const code = tab.entityCode.trim().toLowerCase()
  if (!code) return null

  for (const [key, value] of Object.entries(percentByEntity)) {
    if (value == null || !Number.isFinite(value) || value < 0) continue
    if (key === tab.entityId) return value
    const sibling = siblings.find((t) => t.entityId === key)
    if (
      sibling &&
      sibling.entityCode.trim().toLowerCase() === code
    ) {
      return value
    }
  }

  // Percent keyed under a legacy stub id (ecl/mdo) after the tab became a UUID.
  for (const [key, value] of Object.entries(percentByEntity)) {
    if (value == null || !Number.isFinite(value) || value < 0) continue
    if (key.trim().toLowerCase() === code) return value
  }

  return null
}

export function isValid(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0
}
