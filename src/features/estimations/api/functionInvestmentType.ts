import { BackendApiError, fetchFromBackend } from '@/features/estimations/api/client'
import { ENDPOINTS } from '@/features/estimations/api/endpoints'

export type InvestmentTypeSlug =
  | 'ownership'
  | 'partial-outsourcing'
  | 'full-outsourcing'
  | 'adhoc-outsourcing'

export type FunctionInvestmentTypeRecord = {
  function_investment_type_id: string
  function_master_id: string
  investment_type_id: string
  payback_period: number | null
  from_payback_start: string | null
  contribution_percentage: number | null
  escalation_percentage: number | null
}

type FitApiResponse = {
  success?: boolean
  statusCode?: number
  message?: string
  data?: FunctionInvestmentTypeRecord | null
}

function parseFit(
  data: FitApiResponse['data'],
): FunctionInvestmentTypeRecord | null {
  if (!data || typeof data !== 'object') return null
  const id = data.function_investment_type_id?.trim()
  const functionId = data.function_master_id?.trim()
  if (!id || !functionId) return null
  return {
    function_investment_type_id: id,
    function_master_id: functionId,
    investment_type_id: String(data.investment_type_id ?? ''),
    payback_period:
      data.payback_period != null && Number.isFinite(Number(data.payback_period))
        ? Number(data.payback_period)
        : null,
    from_payback_start: data.from_payback_start ?? null,
    contribution_percentage:
      data.contribution_percentage != null &&
      Number.isFinite(Number(data.contribution_percentage))
        ? Number(data.contribution_percentage)
        : null,
    escalation_percentage:
      data.escalation_percentage != null &&
      Number.isFinite(Number(data.escalation_percentage))
        ? Number(data.escalation_percentage)
        : null,
  }
}

/** POST /functions/investment-type/details */
export async function getFunctionInvestmentTypeDetails(
  functionMasterId: string,
  investmentType: InvestmentTypeSlug,
): Promise<FunctionInvestmentTypeRecord | null> {
  const function_master_id = functionMasterId.trim()
  if (!function_master_id) return null

  try {
    const data = await fetchFromBackend<FitApiResponse>(
      ENDPOINTS.investments.functionInvestmentTypeDetails,
      {
        method: 'POST',
        json: {
          function_master_id,
          investment_type: investmentType,
        },
      },
    )
    if (data.success === false) {
      if (data.statusCode === 404) return null
      throw new Error(data.message || 'Failed to load investment type config')
    }
    return parseFit(data.data)
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) return null
    throw error
  }
}

export type UpsertPartialOutsourcingPayload = {
  function_master_id: string
  payback_period: number
  contribution_percentage: number
  escalation_percentage: number
  function_investment_type_id?: string | null
}

/** Create or update Partial outsourcing (PO) FunctionInvestmentType. */
export async function upsertPartialOutsourcingConfig(
  payload: UpsertPartialOutsourcingPayload,
): Promise<FunctionInvestmentTypeRecord> {
  const function_master_id = payload.function_master_id.trim()
  if (!function_master_id) {
    throw new Error('function_master_id is required')
  }

  const existingId = payload.function_investment_type_id?.trim()
  if (existingId) {
    const data = await fetchFromBackend<FitApiResponse>(
      ENDPOINTS.investments.functionInvestmentTypeUpdate,
      {
        method: 'PUT',
        json: {
          function_investment_type_id: existingId,
          function_master_id,
          investment_type_id: 'PO',
          payback_period: payload.payback_period,
          contribution_percentage: payload.contribution_percentage,
          escalation_percentage: payload.escalation_percentage,
        },
      },
    )
    if (data.success === false) {
      throw new Error(data.message || 'Failed to update outsourcing config')
    }
    const parsed = parseFit(data.data)
    if (!parsed) throw new Error('Invalid update response for outsourcing config')
    return parsed
  }

  const data = await fetchFromBackend<FitApiResponse>(
    ENDPOINTS.investments.functionInvestmentTypeCreate,
    {
      method: 'POST',
      json: {
        function_master_id,
        investment_type_id: 'PO',
        payback_period: payload.payback_period,
        contribution_percentage: payload.contribution_percentage,
        escalation_percentage: payload.escalation_percentage,
      },
    },
  )
  if (data.success === false) {
    throw new Error(data.message || 'Failed to save outsourcing config')
  }
  const parsed = parseFit(data.data)
  if (!parsed) throw new Error('Invalid create response for outsourcing config')
  return parsed
}

export function fitToPartialSettings(
  record: FunctionInvestmentTypeRecord | null | undefined,
): {
  contributionPercentage: number
  escalationPercent: number
  paybackPeriodYears: number
  functionInvestmentTypeId: string
} | null {
  if (!record) return null
  const payback = record.payback_period
  const contribution = record.contribution_percentage
  const escalation = record.escalation_percentage
  if (
    payback == null ||
    !Number.isFinite(payback) ||
    payback <= 0 ||
    contribution == null ||
    !Number.isFinite(contribution) ||
    contribution < 0 ||
    escalation == null ||
    !Number.isFinite(escalation) ||
    escalation < 0
  ) {
    return null
  }
  return {
    contributionPercentage: contribution,
    escalationPercent: escalation,
    paybackPeriodYears: payback,
    functionInvestmentTypeId: record.function_investment_type_id,
  }
}

export type UpsertFullOutsourcingPayload = {
  function_master_id: string
  payback_period: number
  escalation_percentage: number
  /** Phase code (e.g. C1, P2) — stored via PhaseMaster on the backend. */
  from_payback_start: string
  function_investment_type_id?: string | null
}

/** Create or update Full outsourcing (FO) FunctionInvestmentType. */
export async function upsertFullOutsourcingConfig(
  payload: UpsertFullOutsourcingPayload,
): Promise<FunctionInvestmentTypeRecord> {
  const function_master_id = payload.function_master_id.trim()
  if (!function_master_id) {
    throw new Error('function_master_id is required')
  }
  const from_payback_start = payload.from_payback_start.trim()
  if (!from_payback_start) {
    throw new Error('from_payback_start is required')
  }

  const existingId = payload.function_investment_type_id?.trim()
  if (existingId) {
    const data = await fetchFromBackend<FitApiResponse>(
      ENDPOINTS.investments.functionInvestmentTypeUpdate,
      {
        method: 'PUT',
        json: {
          function_investment_type_id: existingId,
          function_master_id,
          investment_type_id: 'FO',
          payback_period: payload.payback_period,
          escalation_percentage: payload.escalation_percentage,
          from_payback_start,
        },
      },
    )
    if (data.success === false) {
      throw new Error(data.message || 'Failed to update full outsourcing config')
    }
    const parsed = parseFit(data.data)
    if (!parsed) {
      throw new Error('Invalid update response for full outsourcing config')
    }
    return parsed
  }

  const data = await fetchFromBackend<FitApiResponse>(
    ENDPOINTS.investments.functionInvestmentTypeCreate,
    {
      method: 'POST',
      json: {
        function_master_id,
        investment_type_id: 'FO',
        payback_period: payload.payback_period,
        escalation_percentage: payload.escalation_percentage,
        from_payback_start,
      },
    },
  )
  if (data.success === false) {
    throw new Error(data.message || 'Failed to save full outsourcing config')
  }
  const parsed = parseFit(data.data)
  if (!parsed) {
    throw new Error('Invalid create response for full outsourcing config')
  }
  return parsed
}

export function fitToFullSettings(
  record: FunctionInvestmentTypeRecord | null | undefined,
): {
  escalationPercent: number
  paybackPeriodYears: number
  paybackStartPhase: string
  functionInvestmentTypeId: string
} | null {
  if (!record) return null
  const payback = record.payback_period
  const escalation = record.escalation_percentage
  const start = record.from_payback_start?.trim() ?? ''
  if (
    payback == null ||
    !Number.isFinite(payback) ||
    payback <= 0 ||
    escalation == null ||
    !Number.isFinite(escalation) ||
    escalation < 0 ||
    !start
  ) {
    return null
  }
  return {
    escalationPercent: escalation,
    paybackPeriodYears: payback,
    paybackStartPhase: start,
    functionInvestmentTypeId: record.function_investment_type_id,
  }
}

async function createInvestmentTypeStub(
  functionMasterId: string,
  investmentTypeId: 'OW' | 'PO' | 'FO' | 'AH',
): Promise<FunctionInvestmentTypeRecord> {
  const function_master_id = functionMasterId.trim()
  if (!function_master_id) {
    throw new Error('function_master_id is required')
  }
  const data = await fetchFromBackend<FitApiResponse>(
    ENDPOINTS.investments.functionInvestmentTypeCreate,
    {
      method: 'POST',
      json: {
        function_master_id,
        investment_type_id: investmentTypeId,
      },
    },
  )
  if (data.success === false) {
    throw new Error(data.message || 'Failed to save delivery mode')
  }
  const parsed = parseFit(data.data)
  if (!parsed) throw new Error('Invalid response when saving delivery mode')
  return parsed
}

import {
  getPreferredDeliveryMode,
  setPreferredDeliveryMode,
} from '@/features/projects/outsourcingPreference'

/**
 * Resolve Ownership vs Outsourcing from preference + FunctionInvestmentType rows.
 * Preference lets the user keep both datasets and switch freely.
 */
export async function resolveDeliveryModeFromApi(
  functionMasterId: string,
): Promise<'ownership' | 'outsourcing' | null> {
  const id = functionMasterId.trim()
  if (!id) return null

  const [partial, full, adhoc, ownership] = await Promise.all([
    getFunctionInvestmentTypeDetails(id, 'partial-outsourcing'),
    getFunctionInvestmentTypeDetails(id, 'full-outsourcing'),
    getFunctionInvestmentTypeDetails(id, 'adhoc-outsourcing'),
    getFunctionInvestmentTypeDetails(id, 'ownership'),
  ])

  const preferred = getPreferredDeliveryMode(id)
  if (preferred === 'ownership' && ownership) return 'ownership'
  if (preferred === 'outsourcing' && (partial || full || adhoc)) {
    return 'outsourcing'
  }
  if (preferred === 'outsourcing' && !ownership) return 'outsourcing'

  if (fitToPartialSettings(partial) || fitToFullSettings(full) || adhoc) {
    return 'outsourcing'
  }
  if (ownership) return 'ownership'
  if (partial || full || adhoc) return 'outsourcing'
  return null
}

/** Persist delivery mode choice as OW or PO FunctionInvestmentType stub. */
export async function persistDeliveryModeChoice(
  functionMasterId: string,
  mode: 'ownership' | 'outsourcing',
): Promise<void> {
  setPreferredDeliveryMode(functionMasterId, mode)
  if (mode === 'ownership') {
    await createInvestmentTypeStub(functionMasterId, 'OW')
    return
  }
  await createInvestmentTypeStub(functionMasterId, 'PO')
}

/** Ensure an AH stub exists for Adhoc cost-item isolation. */
export async function ensureAdhocOutsourcingStub(
  functionMasterId: string,
): Promise<FunctionInvestmentTypeRecord> {
  const existing = await getFunctionInvestmentTypeDetails(
    functionMasterId,
    'adhoc-outsourcing',
  )
  if (existing) return existing
  return createInvestmentTypeStub(functionMasterId, 'AH')
}
