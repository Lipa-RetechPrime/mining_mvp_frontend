import { computeAutomaticValue } from '../calculations/calculations'
import type { Phase } from '../types/estimation'

/**
 * Apply a phase field patch, including mode-switch resets and clearing
 * derived value when percentage is removed in calculated mode.
 */
export function applyPhasePatch(
  phase: Phase,
  patch: Partial<Phase>,
  stepAmount: number,
): Phase {
  let next: Phase = { ...phase, ...patch }

  if (patch.calculationMode && patch.calculationMode !== phase.calculationMode) {
    if (patch.calculationMode === 'automatic') {
      next = { ...next, value: null, percentage: null, calculationMode: 'automatic' }
    } else {
      // Manual: drop percentage so it is not resent / reverse-derived later.
      next = { ...next, percentage: null, value: null, calculationMode: 'manual' }
    }
  }

  const percentageCleared =
    'percentage' in patch &&
    (patch.percentage === null ||
      patch.percentage === undefined ||
      (typeof patch.percentage === 'number' && Number.isNaN(patch.percentage)))

  if (next.calculationMode === 'automatic' && percentageCleared) {
    // Without this, the old value remains and reload reverse-derives the old %.
    next = { ...next, percentage: null, value: null }
  } else if (next.calculationMode === 'automatic' && next.percentage !== null) {
    next = {
      ...next,
      value: computeAutomaticValue(stepAmount, next.percentage),
    }
  }

  return next
}
