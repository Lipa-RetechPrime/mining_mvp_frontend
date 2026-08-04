export function computeAmount(
  qrts: number | null | undefined,
  unitCost: number | null | undefined,
): number {
  if (qrts == null || unitCost == null || Number.isNaN(qrts) || Number.isNaN(unitCost)) {
    return 0
  }
  return roundMoney(qrts * unitCost)
}

/** `percentage` is on a 0–100 scale (e.g. 20 means 20%). */
export function computeAutomaticValue(amount: number, percentage: number): number {
  return roundMoney((amount * percentage) / 100)
}

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export const PERCENT_SUM_EPSILON = 0.1
export const MONEY_SUM_EPSILON = 0.01

/** True when percentages (0–100 scale) sum to 100%. */
export function automaticPercentagesSumTo100(
  percentages: Array<number | null | undefined>,
): boolean {
  const sum = percentages.reduce<number>((acc, p) => acc + (typeof p === 'number' ? p : 0), 0)
  return Math.abs(sum - 100) <= PERCENT_SUM_EPSILON
}

/** Effective Lakhs contribution of a phase for amount-sum checks. */
export function resolvePhaseValue(
  phase: { calculationMode: 'manual' | 'automatic'; value: number | null; percentage: number | null },
  stepAmount: number,
): number {
  if (phase.calculationMode === 'automatic') {
    if (phase.percentage === null || Number.isNaN(phase.percentage)) return 0
    return computeAutomaticValue(stepAmount, phase.percentage)
  }
  if (phase.value === null || Number.isNaN(phase.value)) return 0
  return roundMoney(phase.value)
}

export function phaseValuesSumToAmount(
  phases: Array<{ calculationMode: 'manual' | 'automatic'; value: number | null; percentage: number | null }>,
  stepAmount: number,
): boolean {
  const sum = phases.reduce((acc, phase) => acc + resolvePhaseValue(phase, stepAmount), 0)
  return Math.abs(roundMoney(sum) - roundMoney(stepAmount)) <= MONEY_SUM_EPSILON
}
