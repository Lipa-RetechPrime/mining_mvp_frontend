import {
  phaseTypeAtIndex,
  phaseTypeIndex,
  PHASE_TYPE_COUNT,
} from '@/features/estimations/phases/phaseTypes'

/** Contributor share of a phase value (lakhs). */
export function contributorPhaseAmount(
  phaseValue: number | null | undefined,
  contributionPercentage: number | null | undefined,
): number | null {
  if (
    phaseValue == null ||
    !Number.isFinite(phaseValue) ||
    contributionPercentage == null ||
    !Number.isFinite(contributionPercentage)
  ) {
    return null
  }
  return (phaseValue * contributionPercentage) / 100
}

/**
 * Partial contribution payables:
 * a = sum of contributor amounts on filled phases
 * remaining = totalAmount − a
 * b = remaining + remaining × escalation%
 */
export function computeExternalAgentPayable(params: {
  totalAmount: number
  contributionAmountA: number
  escalationPercent: number
}): { remaining: number; payableB: number } {
  const remaining = Math.max(0, params.totalAmount - params.contributionAmountA)
  const payableB = remaining + (remaining * params.escalationPercent) / 100
  return { remaining, payableB }
}

/** Phases that already have a non-zero investment value. */
export function collectFilledPhaseCodes(
  phaseValues: Record<string, number | null | undefined>,
): string[] {
  return Object.entries(phaseValues)
    .filter(
      ([, value]) =>
        value != null && Number.isFinite(Number(value)) && Number(value) !== 0,
    )
    .map(([code]) => code)
}

/**
 * Latest (highest catalog index) filled phase across many cost-item maps.
 * Used so Partial payback for an entity starts after the top-most contributor phase.
 */
export function latestFilledPhaseAmong(
  phaseValueMaps: Array<Record<string, number | null | undefined>>,
): string | null {
  let maxFilledIndex = -1
  let latestCode: string | null = null
  for (const phaseValues of phaseValueMaps) {
    for (const code of collectFilledPhaseCodes(phaseValues)) {
      const idx = phaseTypeIndex(code)
      if (idx != null && idx > maxFilledIndex) {
        maxFilledIndex = idx
        latestCode = code
      }
    }
  }
  return latestCode
}

/**
 * Next `paybackN` catalog phases after the last filled phase.
 * Catalog order: C1, C2, P1… — same as ownership (life-of-mine still caps total).
 */
export function nextPaybackPhaseCodes(
  filledPhaseCodes: string[],
  paybackN: number,
  phaseLimit?: number | null,
): string[] {
  if (!Number.isFinite(paybackN) || paybackN <= 0) return []

  let maxFilledIndex = -1
  for (const code of filledPhaseCodes) {
    const idx = phaseTypeIndex(code)
    if (idx != null && idx > maxFilledIndex) maxFilledIndex = idx
  }

  const maxAllowed =
    phaseLimit != null && Number.isFinite(phaseLimit) && phaseLimit > 0
      ? Math.min(PHASE_TYPE_COUNT, Math.floor(phaseLimit))
      : PHASE_TYPE_COUNT

  const targets: string[] = []
  let cursor = maxFilledIndex + 1
  while (targets.length < paybackN && cursor < maxAllowed) {
    targets.push(phaseTypeAtIndex(cursor))
    cursor += 1
  }
  return targets
}

/** Equal split of payable b across target payback phases. */
export function distributePaybackEqually(
  payableB: number,
  targetPhaseCodes: string[],
): Record<string, number> {
  const out: Record<string, number> = {}
  if (targetPhaseCodes.length === 0 || !Number.isFinite(payableB)) return out
  const share = payableB / targetPhaseCodes.length
  for (const code of targetPhaseCodes) {
    out[code] = share
  }
  return out
}

/**
 * Full contribution payable:
 * b = totalAmount × (1 + escalation%)
 * (no user contribution).
 */
export function computeFullAgentPayable(params: {
  totalAmount: number
  escalationPercent: number
}): number {
  const total =
    Number.isFinite(params.totalAmount) && params.totalAmount > 0
      ? params.totalAmount
      : 0
  const esc =
    Number.isFinite(params.escalationPercent) && params.escalationPercent >= 0
      ? params.escalationPercent
      : 0
  return total + (total * esc) / 100
}

/**
 * `paybackN` catalog phases starting at `startPhaseCode` (inclusive),
 * capped by life-of-mine phase limit.
 */
export function paybackPhaseCodesFromStart(
  startPhaseCode: string,
  paybackN: number,
  phaseLimit?: number | null,
): string[] {
  if (!Number.isFinite(paybackN) || paybackN <= 0) return []
  const startIdx = phaseTypeIndex(startPhaseCode)
  if (startIdx == null) return []

  const maxAllowed =
    phaseLimit != null && Number.isFinite(phaseLimit) && phaseLimit > 0
      ? Math.min(PHASE_TYPE_COUNT, Math.floor(phaseLimit))
      : PHASE_TYPE_COUNT

  const targets: string[] = []
  let cursor = startIdx
  while (targets.length < paybackN && cursor < maxAllowed) {
    targets.push(phaseTypeAtIndex(cursor))
    cursor += 1
  }
  return targets
}

/**
 * Full-contribution cost-item display phases:
 * Amount spread equally across N phases from start, then each share × (1 + E%).
 * Same codes/values as Overall external-agent payback for that item.
 */
export function buildFullCostItemPaybackPhases(params: {
  totalAmount: number | null | undefined
  escalationPercent: number
  paybackPeriodYears: number
  paybackStartPhase: string
  phaseLimit?: number | null
}): Array<{ phaseType: string; value: number }> {
  const targets = paybackPhaseCodesFromStart(
    params.paybackStartPhase,
    params.paybackPeriodYears,
    params.phaseLimit,
  )
  if (targets.length === 0) return []

  const payableB = computeFullAgentPayable({
    totalAmount: params.totalAmount ?? 0,
    escalationPercent: params.escalationPercent,
  })
  const distributed = distributePaybackEqually(payableB, targets)
  return targets.map((phaseType) => ({
    phaseType,
    value: distributed[phaseType] ?? 0,
  }))
}
