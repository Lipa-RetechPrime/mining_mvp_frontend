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
 * Catalog order: C1, C2, P1… — same as ownership.
 * Example: last filled P2, payback 3 → P3, P4, P5 (capped by mine phaseLimit).
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
  if (maxFilledIndex < 0) return []

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

/** Catalog index of the latest filled phase, or -1 when none. */
export function latestFilledPhaseIndex(
  filledPhaseCodes: string[],
): number {
  let maxFilledIndex = -1
  for (const code of filledPhaseCodes) {
    const idx = phaseTypeIndex(code)
    if (idx != null && idx > maxFilledIndex) maxFilledIndex = idx
  }
  return maxFilledIndex
}

/**
 * True when a filled last-phase leaves fewer than `paybackN` slots under the
 * mine phase limit for the next payback window.
 */
export function hasInsufficientPaybackRoom(params: {
  filledPhaseCodes: string[]
  phaseLimit: number | null | undefined
  paybackPeriodYears: number | null | undefined
}): boolean {
  const payback = params.paybackPeriodYears
  const limit = params.phaseLimit
  if (
    payback == null ||
    !Number.isFinite(payback) ||
    payback <= 0 ||
    limit == null ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return false
  }
  const lastIdx = latestFilledPhaseIndex(params.filledPhaseCodes)
  if (lastIdx < 0) return false
  const room = Math.floor(limit) - lastIdx - 1
  return room < Math.floor(payback)
}

/** User-facing warning when the last contributor entry leaves too little payback room. */
export function insufficientPaybackRoomMessage(
  phaseLimit: number,
  paybackPeriodYears: number,
): string {
  return `Phase value cannot exceed mine limit (${Math.floor(phaseLimit)}). After your last entry there are not enough phases left for a full ${Math.floor(paybackPeriodYears)}-year payback window.`
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
 * capped by life-of-mine phase limit (total slots from C1).
 */
export function paybackPhaseCodesFromStart(
  startPhaseCode: string,
  paybackN: number,
  phaseLimit?: number | null,
): string[] {
  const n = Number(paybackN)
  if (!Number.isFinite(n) || n <= 0) return []
  const startIdx = phaseTypeIndex(startPhaseCode)
  if (startIdx == null) return []

  const maxAllowed =
    phaseLimit != null && Number.isFinite(Number(phaseLimit)) && Number(phaseLimit) > 0
      ? Math.min(PHASE_TYPE_COUNT, Math.floor(Number(phaseLimit)))
      : PHASE_TYPE_COUNT

  // If the start phase sits at/after the mine limit, still open a window of N
  // phases from start so Full config is not blank (limit may be mis-synced).
  const endExclusive = Math.max(maxAllowed, startIdx + Math.floor(n))
  const hardCap = Math.min(PHASE_TYPE_COUNT, endExclusive)

  const targets: string[] = []
  let cursor = startIdx
  while (targets.length < Math.floor(n) && cursor < hardCap) {
    targets.push(phaseTypeAtIndex(cursor))
    cursor += 1
  }
  return targets
}

/**
 * Max phase-row count before `paybackN` consecutive slots cannot fit under the
 * mine limit after the last catalog index that still has room for payback.
 * Contributor may fill up through index `phaseLimit - paybackN - 1`.
 * Example: limit 9, payback 3 → last ok filled index 5 (P4); next window P5–P7.
 */
export function maxContributorPhaseCount(
  phaseLimit: number | null | undefined,
  paybackPeriodYears: number | null | undefined,
): number | null {
  if (
    phaseLimit == null ||
    !Number.isFinite(phaseLimit) ||
    phaseLimit <= 0 ||
    paybackPeriodYears == null ||
    !Number.isFinite(paybackPeriodYears) ||
    paybackPeriodYears <= 0
  ) {
    return null
  }
  // Count of phases from C1 through the latest allowed contributor fill.
  return Math.max(
    0,
    Math.floor(phaseLimit) - Math.floor(paybackPeriodYears),
  )
}

/**
 * True when adding more phase cards would push past the latest index that can
 * still host a full payback window under the mine limit.
 */
export function wouldExceedContributorPhaseReserve(params: {
  currentPhaseCount: number
  phaseLimit: number | null | undefined
  paybackPeriodYears: number | null | undefined
  phasesToAdd?: number
}): boolean {
  const max = maxContributorPhaseCount(
    params.phaseLimit,
    params.paybackPeriodYears,
  )
  if (max == null) return false
  const toAdd = Math.max(1, Math.floor(params.phasesToAdd ?? 1))
  return params.currentPhaseCount + toAdd > max
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

/** Attach Full payback phase rows onto a cost item so save/validation see real phase values. */
export function stampFullPaybackPhasesOnStep<T extends {
  amount: number | null | undefined
  phaseLimit?: number | null
  phases: Array<{
    id: string
    phaseType: string
    calculationMode: 'manual' | 'automatic'
    value: number | null
    percentage: number | null
  }>
}>(
  step: T,
  settings: {
    escalationPercent: number
    paybackPeriodYears: number
    paybackStartPhase: string
    phaseLimit?: number | null
  },
  createPhaseId: () => string = () => `ph-${Math.random().toString(36).slice(2, 10)}`,
): T {
  const built = buildFullCostItemPaybackPhases({
    totalAmount: step.amount,
    escalationPercent: settings.escalationPercent,
    paybackPeriodYears: settings.paybackPeriodYears,
    paybackStartPhase: settings.paybackStartPhase,
    phaseLimit: settings.phaseLimit ?? step.phaseLimit,
  })
  if (built.length === 0) return step
  return {
    ...step,
    phases: built.map((phase) => ({
      id: createPhaseId(),
      phaseType: phase.phaseType,
      calculationMode: 'manual' as const,
      value: phase.value,
      percentage: null,
    })),
  } as T
}
