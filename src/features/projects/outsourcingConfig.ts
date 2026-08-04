import { SECTOR_CATALOG } from '@/features/estimations/api/master'

/** Hard-coded for MVP — later from master / catalog. */
export const PARTIAL_AGENT_OPTIONS = [
  { code: 'external_agent', label: 'External Agent' },
  // Future: { code: 'mdo', label: 'MDO' },
] as const

export const FULL_CONTRIBUTION_OPTIONS = [
  { code: 'flat_rate', label: 'Flat rate of interest' },
] as const

export type OutsourcingContributionKind = 'partial' | 'full'
export type PartialAgentCode = (typeof PARTIAL_AGENT_OPTIONS)[number]['code']
export type FullContributionCode = (typeof FULL_CONTRIBUTION_OPTIONS)[number]['code']

export type OutsourcingConfig = {
  contributionKind: OutsourcingContributionKind
  /** Partial branch */
  partialAgent?: PartialAgentCode
  paybackPeriodYears?: number | null
  /** functionId → escalation % (Partial) */
  escalationByFunction?: Record<string, number | null>
  /** Full branch */
  fullContributionModel?: FullContributionCode
  escalationPercent?: number | null
  paybackStartPhase?: string | null
}

const STORAGE_PREFIX = 'mining.outsourcingConfig:'

export function defaultFunctionEscalations(): Record<string, number | null> {
  return Object.fromEntries(SECTOR_CATALOG.map((sector) => [sector.id, null]))
}

export function createEmptyOutsourcingConfig(): OutsourcingConfig {
  return {
    contributionKind: 'partial',
    partialAgent: 'external_agent',
    paybackPeriodYears: null,
    escalationByFunction: defaultFunctionEscalations(),
    fullContributionModel: 'flat_rate',
    escalationPercent: null,
    paybackStartPhase: null,
  }
}

export function getStoredOutsourcingConfig(
  projectId: string,
): OutsourcingConfig | null {
  if (typeof window === 'undefined' || !projectId) return null
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${projectId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OutsourcingConfig
    if (parsed?.contributionKind !== 'partial' && parsed?.contributionKind !== 'full') {
      return null
    }
    return {
      ...createEmptyOutsourcingConfig(),
      ...parsed,
      escalationByFunction: {
        ...defaultFunctionEscalations(),
        ...(parsed.escalationByFunction ?? {}),
      },
    }
  } catch {
    return null
  }
}

export function setStoredOutsourcingConfig(
  projectId: string,
  config: OutsourcingConfig,
): void {
  if (typeof window === 'undefined' || !projectId) return
  window.localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(config))
}

export function clearStoredOutsourcingConfig(projectId: string): void {
  if (typeof window === 'undefined' || !projectId) return
  window.localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`)
}

export type OutsourcingFieldErrors = Record<string, string>

export function validateOutsourcingConfig(
  config: OutsourcingConfig,
  options?: { currentFunctionId?: string },
): OutsourcingFieldErrors {
  const errors: OutsourcingFieldErrors = {}
  const years = config.paybackPeriodYears
  if (years == null || !Number.isFinite(years) || years <= 0) {
    errors.paybackPeriodYears = 'Enter a payback period greater than 0'
  }

  if (config.contributionKind === 'partial') {
    if (!config.partialAgent) {
      errors.partialAgent = 'Select an outsourcing agent'
    }
    // Partial escalation is only validated for the active cost function
    // (side-nav sector). Other functions may differ and are set when selected.
    const functionId =
      options?.currentFunctionId || SECTOR_CATALOG[0]?.id || ''
    const sector = SECTOR_CATALOG.find((item) => item.id === functionId)
    const value = config.escalationByFunction?.[functionId]
    if (value == null || !Number.isFinite(value) || value < 0) {
      errors[`escalation.${functionId}`] = sector
        ? `Escalation % is required for ${sector.name}`
        : 'Escalation % is required for the current function'
    }
  } else {
    if (!config.fullContributionModel) {
      errors.fullContributionModel = 'Select a contribution model'
    }
    const pct = config.escalationPercent
    if (pct == null || !Number.isFinite(pct) || pct < 0) {
      errors.escalationPercent = 'Enter a non-negative escalation percentage'
    }
    if (!config.paybackStartPhase?.trim()) {
      errors.paybackStartPhase = 'Select the phase from which payback starts'
    }
  }

  return errors
}
