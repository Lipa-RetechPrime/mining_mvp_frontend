// import { SECTOR_CATALOG } from '@/features/estimations/api/master'

/** Hard-coded for MVP — later from master / catalog. */
export const PARTIAL_AGENT_OPTIONS = [
  { code: 'external_agent', label: 'External Agent' },
  // Future: { code: 'mdo', label: 'MDO' },
] as const

export const FULL_CONTRIBUTION_OPTIONS = [
  { code: 'flat_rate', label: 'Flat rate of interest' },
] as const

export type OutsourcingContributionKind = 'partial' | 'full' | 'adhoc'
export type PartialAgentCode = (typeof PARTIAL_AGENT_OPTIONS)[number]['code']
export type FullContributionCode = (typeof FULL_CONTRIBUTION_OPTIONS)[number]['code']

export type OutsourcingConfig = {
  contributionKind: OutsourcingContributionKind
  /** Partial branch */
  partialAgent?: PartialAgentCode
  paybackPeriodYears?: number | null
  contributionPercentage?: number | null
  /** functionId → escalation % (Partial) — legacy UI shape; Partial form uses escalationPercent */
  escalationByFunction?: Record<string, number | null>
  /** Full branch */
  fullContributionModel?: FullContributionCode
  escalationPercent?: number | null
  paybackStartPhase?: string | null
}

export function defaultFunctionEscalations(): Record<string, number | null> {
  return Object.fromEntries([])
}

export function createEmptyOutsourcingConfig(): OutsourcingConfig {
  return {
    contributionKind: 'partial',
    partialAgent: 'external_agent',
    paybackPeriodYears: null,
    contributionPercentage: null,
    escalationByFunction: defaultFunctionEscalations(),
    fullContributionModel: 'flat_rate',
    escalationPercent: null,
    paybackStartPhase: null,
  }
}

export type OutsourcingFieldErrors = Record<string, string>

export function validateOutsourcingConfig(
  config: OutsourcingConfig,
  options?: { currentFunctionId?: string; currentFunctionName?: string },
): OutsourcingFieldErrors {
  const errors: OutsourcingFieldErrors = {}

  // Adhoc: radio selection only for now — no additional fields.
  if (config.contributionKind === 'adhoc') {
    return errors
  }

  if (config.contributionKind === 'partial') {
    if (!config.partialAgent) {
      errors.partialAgent = 'Select an outsourcing agent'
    }
    const years = config.paybackPeriodYears
    if (years == null || !Number.isFinite(years) || years <= 0) {
      errors.paybackPeriodYears = 'Enter a payback period greater than 0'
    }
    const contribution = config.contributionPercentage
    if (
      contribution == null ||
      !Number.isFinite(contribution) ||
      contribution < 0
    ) {
      errors.contributionPercentage =
        'Enter a non-negative contribution percentage'
    }
    // Prefer single escalationPercent (3-field Partial form); fall back to per-function map.
    const escalation =
      config.escalationPercent ??
      (options?.currentFunctionId
        ? config.escalationByFunction?.[options.currentFunctionId]
        : null)
    if (escalation == null || !Number.isFinite(escalation) || escalation < 0) {
      errors.escalationPercent = 'Enter a non-negative escalation percentage'
    }
    return errors
  }

  // Full: payback period, escalation %, start phase (no contribution model / %).
  const years = config.paybackPeriodYears
  if (years == null || !Number.isFinite(years) || years <= 0) {
    errors.paybackPeriodYears = 'Enter a payback period greater than 0'
  }
  const pct = config.escalationPercent
  if (pct == null || !Number.isFinite(pct) || pct < 0) {
    errors.escalationPercent = 'Enter a non-negative escalation percentage'
  }
  if (!config.paybackStartPhase?.trim()) {
    errors.paybackStartPhase = 'Select the phase from which payback starts'
  }

  return errors
}
