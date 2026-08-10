import { BackendApiError, fetchFromBackend } from '@/features/estimations/api/client'
import { ENDPOINTS } from '@/features/estimations/api/endpoints'
import {
  resolvePhaseCodeFromIdOrName,
  resolvePhaseIdFromCodeOrId,
} from '@/features/estimations/api/phases'
import { normalizeCatalogPhaseCode } from '@/features/estimations/phases/phaseTypes'
import {
  getPreferredDeliveryMode,
  setPreferredDeliveryMode,
} from '@/features/projects/outsourcingPreference'

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
  data?: FunctionInvestmentTypeRecord | FunctionInvestmentTypeRecord[] | null
}

type InvestmentTypeMasterRow = {
  investment_type_id: string
  type: string
  agent_type?: string
}

type InvestmentTypeListResponse = {
  success?: boolean
  statusCode?: number
  message?: string
  data?: InvestmentTypeMasterRow[] | null
}

let investmentTypeMasterCache: Map<InvestmentTypeSlug, string> | null = null
let investmentTypeMasterLoad: Promise<Map<InvestmentTypeSlug, string>> | null =
  null

/** GET /functions/investment-type-list — maps slug → InvestmentType UUID. */
async function loadInvestmentTypeMasterIds(): Promise<
  Map<InvestmentTypeSlug, string>
> {
  if (investmentTypeMasterCache) return investmentTypeMasterCache
  if (!investmentTypeMasterLoad) {
    investmentTypeMasterLoad = (async () => {
      const data = await fetchFromBackend<InvestmentTypeListResponse>(
        ENDPOINTS.investments.functionInvestmentTypeList,
        { method: 'GET' },
      )
      if (data.success === false) {
        throw new Error(data.message || 'Failed to load investment type master')
      }
      const map = new Map<InvestmentTypeSlug, string>()
      const rows = Array.isArray(data.data) ? data.data : []
      for (const row of rows) {
        const slug = String(row.type ?? '').trim() as InvestmentTypeSlug
        const id = String(row.investment_type_id ?? '').trim()
        if (
          id &&
          (slug === 'ownership' ||
            slug === 'partial-outsourcing' ||
            slug === 'full-outsourcing' ||
            slug === 'adhoc-outsourcing')
        ) {
          map.set(slug, id)
        }
      }
      investmentTypeMasterCache = map
      return map
    })().catch((error) => {
      investmentTypeMasterLoad = null
      throw error
    })
  }
  return investmentTypeMasterLoad
}

/** Resolve InvestmentType master UUID for create/update payloads. */
async function resolveInvestmentTypeMasterId(
  slug: InvestmentTypeSlug,
): Promise<string> {
  const map = await loadInvestmentTypeMasterIds()
  const id = map.get(slug)?.trim()
  if (!id) {
    throw new Error(
      `Investment type "${slug}" not found in InvestmentType master list`,
    )
  }
  return id
}

function readNumericField(
  data: Record<string, unknown>,
  snake: string,
  camel: string,
): number | null {
  const raw = data[snake] ?? data[camel]
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function readStringField(
  data: Record<string, unknown>,
  snake: string,
  camel: string,
): string | null {
  const raw = data[snake] ?? data[camel]
  if (raw == null) return null
  const s = String(raw).trim()
  return s || null
}

function parseFit(
  data: FitApiResponse['data'],
): FunctionInvestmentTypeRecord | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  const id = readStringField(
    row,
    'function_investment_type_id',
    'functionInvestmentTypeId',
  )
  const functionId = readStringField(
    row,
    'function_master_id',
    'functionMasterId',
  )
  if (!id || !functionId) return null
  return {
    function_investment_type_id: id,
    function_master_id: functionId,
    investment_type_id: String(
      row.investment_type_id ?? row.investmentTypeId ?? '',
    ),
    payback_period: readNumericField(row, 'payback_period', 'paybackPeriod'),
    from_payback_start: readStringField(
      row,
      'from_payback_start',
      'fromPaybackStart',
    ),
    contribution_percentage: readNumericField(
      row,
      'contribution_percentage',
      'contributionPercentage',
    ),
    escalation_percentage: readNumericField(
      row,
      'escalation_percentage',
      'escalationPercentage',
    ),
  }
}

/** Nest details endpoint returns `data: Fit[]`; create/update return a single object. */
function parseFitResponse(
  data: FitApiResponse['data'],
): FunctionInvestmentTypeRecord | null {
  if (Array.isArray(data)) {
    for (const row of data) {
      const parsed = parseFit(row)
      if (parsed) return parsed
    }
    return null
  }
  return parseFit(data)
}

let fitDetailsCache: Map<
  string,
  { at: number; data: FunctionInvestmentTypeRecord | null }
> | null = null
let fitDetailsInflight = new Map<
  string,
  Promise<FunctionInvestmentTypeRecord | null>
>()
const FIT_DETAILS_TTL_MS = 30_000

function fitDetailsCacheKey(
  functionMasterId: string,
  investmentType: InvestmentTypeSlug,
): string {
  return `${functionMasterId.trim()}:${investmentType}`
}

function getFitDetailsCache(): Map<
  string,
  { at: number; data: FunctionInvestmentTypeRecord | null }
> {
  if (!fitDetailsCache) fitDetailsCache = new Map()
  return fitDetailsCache
}

/** Drop cached FIT details (after create/update or mode change). */
export function invalidateFunctionInvestmentTypeDetailsCache(
  functionMasterId?: string,
): void {
  const cache = getFitDetailsCache()
  if (!functionMasterId?.trim()) {
    cache.clear()
    fitDetailsInflight.clear()
    return
  }
  const prefix = `${functionMasterId.trim()}:`
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
  for (const key of [...fitDetailsInflight.keys()]) {
    if (key.startsWith(prefix)) fitDetailsInflight.delete(key)
  }
}

/** POST /functions/function-investment-type-details */
export async function getFunctionInvestmentTypeDetails(
  functionMasterId: string,
  investmentType: InvestmentTypeSlug,
): Promise<FunctionInvestmentTypeRecord | null> {
  const function_master_id = functionMasterId.trim()
  if (!function_master_id) return null

  const cacheKey = fitDetailsCacheKey(function_master_id, investmentType)
  const cached = getFitDetailsCache().get(cacheKey)
  if (cached && Date.now() - cached.at < FIT_DETAILS_TTL_MS) {
    return cached.data
  }
  const existingInflight = fitDetailsInflight.get(cacheKey)
  if (existingInflight) return existingInflight

  const request = (async (): Promise<FunctionInvestmentTypeRecord | null> => {
    // DTO: function_master_id + investment_type_id (both UUIDs). Resolve slug via master list.
    let investment_type_id: string
    try {
      investment_type_id = await resolveInvestmentTypeMasterId(investmentType)
    } catch (error) {
      if (investmentType === 'adhoc-outsourcing') return null
      throw error
    }

    try {
      const data = await fetchFromBackend<FitApiResponse>(
        ENDPOINTS.investments.functionInvestmentTypeDetails,
        {
          method: 'POST',
          json: {
            function_master_id,
            investment_type_id,
          },
        },
      )
      if (data.success === false) {
        if (data.statusCode === 404) return null
        throw new Error(data.message || 'Failed to load investment type config')
      }
      return withPhaseCodeFromPaybackStart(parseFitResponse(data.data))
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) return null
      if (
        investmentType === 'adhoc-outsourcing' &&
        error instanceof BackendApiError &&
        (error.status === 400 || error.status === 500)
      ) {
        return null
      }
      throw error
    }
  })()

  fitDetailsInflight.set(cacheKey, request)
  try {
    const data = await request
    getFitDetailsCache().set(cacheKey, { at: Date.now(), data })
    return data
  } finally {
    fitDetailsInflight.delete(cacheKey)
  }
}

export type OutsourcingFitBundle = {
  partial: FunctionInvestmentTypeRecord | null
  full: FunctionInvestmentTypeRecord | null
  adhoc: FunctionInvestmentTypeRecord | null
}

function slugForOutsourcingKind(
  kind: 'partial' | 'full' | 'adhoc',
): InvestmentTypeSlug {
  if (kind === 'full') return 'full-outsourcing'
  if (kind === 'adhoc') return 'adhoc-outsourcing'
  return 'partial-outsourcing'
}

/** Fetch a single outsourcing FIT for the active contribution kind. */
export async function loadOutsourcingFitForKind(
  functionMasterId: string,
  kind: 'partial' | 'full' | 'adhoc',
): Promise<FunctionInvestmentTypeRecord | null> {
  const id = functionMasterId.trim()
  if (!id) return null
  return getFunctionInvestmentTypeDetails(id, slugForOutsourcingKind(kind))
}

/**
 * @deprecated Prefer {@link loadOutsourcingFitForKind} — fetches all three kinds.
 * Kept for rare discovery; prefer active-kind loads.
 */
export async function loadOutsourcingFitBundle(
  functionMasterId: string,
): Promise<OutsourcingFitBundle> {
  const id = functionMasterId.trim()
  if (!id) {
    return { partial: null, full: null, adhoc: null }
  }
  const [partial, full, adhoc] = await Promise.all([
    getFunctionInvestmentTypeDetails(id, 'partial-outsourcing'),
    getFunctionInvestmentTypeDetails(id, 'full-outsourcing'),
    getFunctionInvestmentTypeDetails(id, 'adhoc-outsourcing'),
  ])
  return { partial, full, adhoc }
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

  const investment_type_id = await resolveInvestmentTypeMasterId(
    'partial-outsourcing',
  )

  const existingId = payload.function_investment_type_id?.trim()
  if (existingId) {
    const data = await fetchFromBackend<FitApiResponse>(
      ENDPOINTS.investments.functionInvestmentTypeUpdate,
      {
        method: 'PUT',
        json: {
          function_investment_type_id: existingId,
          function_master_id,
          investment_type_id,
          payback_period: payload.payback_period,
          contribution_percentage: payload.contribution_percentage,
          escalation_percentage: payload.escalation_percentage,
        },
      },
    )
    if (data.success === false) {
      throw new Error(data.message || 'Failed to update outsourcing config')
    }
    const parsed = parseFitResponse(data.data)
    if (!parsed) throw new Error('Invalid update response for outsourcing config')
    invalidateFunctionInvestmentTypeDetailsCache(function_master_id)
    return parsed
  }

  const data = await fetchFromBackend<FitApiResponse>(
    ENDPOINTS.investments.functionInvestmentTypeCreate,
    {
      method: 'POST',
      json: {
        function_master_id,
        investment_type_id,
        payback_period: payload.payback_period,
        contribution_percentage: payload.contribution_percentage,
        escalation_percentage: payload.escalation_percentage,
      },
    },
  )
  if (data.success === false) {
    throw new Error(data.message || 'Failed to save outsourcing config')
  }
  const parsed = parseFitResponse(data.data)
  if (!parsed) throw new Error('Invalid create response for outsourcing config')
  invalidateFunctionInvestmentTypeDetailsCache(function_master_id)
  return parsed
}

/** Soft map — prefills whatever the API returned (nulls stay null). */
export function softPartialFieldsFromFit(
  record: FunctionInvestmentTypeRecord | null | undefined,
): {
  paybackPeriodYears: number | null
  contributionPercentage: number | null
  escalationPercent: number | null
  functionInvestmentTypeId: string
} | null {
  if (!record) return null
  return {
    paybackPeriodYears: record.payback_period,
    contributionPercentage: record.contribution_percentage,
    escalationPercent: record.escalation_percentage,
    functionInvestmentTypeId: record.function_investment_type_id,
  }
}

export function fitToPartialSettings(
  record: FunctionInvestmentTypeRecord | null | undefined,
): {
  contributionPercentage: number
  escalationPercent: number
  paybackPeriodYears: number
  functionInvestmentTypeId: string
} | null {
  const soft = softPartialFieldsFromFit(record)
  if (!soft) return null
  const { paybackPeriodYears: payback, contributionPercentage: contribution, escalationPercent: escalation } =
    soft
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
    functionInvestmentTypeId: soft.functionInvestmentTypeId,
  }
}

export type UpsertFullOutsourcingPayload = {
  function_master_id: string
  payback_period: number
  escalation_percentage: number
  /** Phase code (e.g. C1, P2) or PhaseMaster UUID — resolved to UUID on save. */
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
  const from_payback_start = await resolvePhaseIdFromCodeOrId(
    payload.from_payback_start,
  )

  const investment_type_id = await resolveInvestmentTypeMasterId(
    'full-outsourcing',
  )

  const existingId = payload.function_investment_type_id?.trim()
  if (existingId) {
    const data = await fetchFromBackend<FitApiResponse>(
      ENDPOINTS.investments.functionInvestmentTypeUpdate,
      {
        method: 'PUT',
        json: {
          function_investment_type_id: existingId,
          function_master_id,
          investment_type_id,
          payback_period: payload.payback_period,
          escalation_percentage: payload.escalation_percentage,
          from_payback_start,
        },
      },
    )
    if (data.success === false) {
      throw new Error(data.message || 'Failed to update full outsourcing config')
    }
    const parsed = parseFitResponse(data.data)
    if (!parsed) {
      throw new Error('Invalid update response for full outsourcing config')
    }
    invalidateFunctionInvestmentTypeDetailsCache(function_master_id)
    return (await withPhaseCodeFromPaybackStart(parsed))!
  }

  const data = await fetchFromBackend<FitApiResponse>(
    ENDPOINTS.investments.functionInvestmentTypeCreate,
    {
      method: 'POST',
      json: {
        function_master_id,
        investment_type_id,
        payback_period: payload.payback_period,
        escalation_percentage: payload.escalation_percentage,
        from_payback_start,
      },
    },
  )
  if (data.success === false) {
    throw new Error(data.message || 'Failed to save full outsourcing config')
  }
  const parsed = parseFitResponse(data.data)
  if (!parsed) {
    throw new Error('Invalid create response for full outsourcing config')
  }
  invalidateFunctionInvestmentTypeDetailsCache(function_master_id)
  return (await withPhaseCodeFromPaybackStart(parsed))!
}

/** Nest often stores from_payback_start as UUID; UI needs P9/C1 codes. */
async function withPhaseCodeFromPaybackStart(
  record: FunctionInvestmentTypeRecord | null,
): Promise<FunctionInvestmentTypeRecord | null> {
  if (!record) return null
  const raw = record.from_payback_start?.trim()
  if (!raw) return record
  const already = normalizeCatalogPhaseCode(raw)
  if (already) {
    return already === raw ? record : { ...record, from_payback_start: already }
  }
  try {
    const code = await resolvePhaseCodeFromIdOrName(raw)
    const normalized = normalizeCatalogPhaseCode(code) ?? code
    if (normalized === raw) return record
    return { ...record, from_payback_start: normalized }
  } catch {
    return record
  }
}


/** Soft map — prefills whatever the API returned (nulls stay null). */
export function softFullFieldsFromFit(
  record: FunctionInvestmentTypeRecord | null | undefined,
): {
  escalationPercent: number | null
  paybackPeriodYears: number | null
  paybackStartPhase: string | null
  functionInvestmentTypeId: string
} | null {
  if (!record) return null
  const start = record.from_payback_start?.trim() || null
  return {
    escalationPercent: record.escalation_percentage,
    paybackPeriodYears: record.payback_period,
    paybackStartPhase: start,
    functionInvestmentTypeId: record.function_investment_type_id,
  }
}

export function fitToFullSettings(
  record: FunctionInvestmentTypeRecord | null | undefined,
): {
  escalationPercent: number
  paybackPeriodYears: number
  paybackStartPhase: string
  functionInvestmentTypeId: string
} | null {
  const soft = softFullFieldsFromFit(record)
  if (!soft) return null
  const payback = Number(soft.paybackPeriodYears)
  const escalation = Number(soft.escalationPercent)
  const startRaw = soft.paybackStartPhase?.trim() || ''
  const start =
    normalizeCatalogPhaseCode(startRaw) ??
    (/^[0-9a-f-]{36}$/i.test(startRaw) ? startRaw : startRaw) // keep UUID for later resolve
  if (
    !Number.isFinite(payback) ||
    payback <= 0 ||
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
    functionInvestmentTypeId: soft.functionInvestmentTypeId,
  }
}

async function createInvestmentTypeStub(
  functionMasterId: string,
  investmentType: InvestmentTypeSlug,
): Promise<FunctionInvestmentTypeRecord> {
  const function_master_id = functionMasterId.trim()
  if (!function_master_id) {
    throw new Error('function_master_id is required')
  }
  const investment_type_id = await resolveInvestmentTypeMasterId(investmentType)
  const data = await fetchFromBackend<FitApiResponse>(
    ENDPOINTS.investments.functionInvestmentTypeCreate,
    {
      method: 'POST',
      json: {
        function_master_id,
        investment_type_id,
      },
    },
  )
  if (data.success === false) {
    throw new Error(data.message || 'Failed to save delivery mode')
  }
  const parsed = parseFitResponse(data.data)
  if (!parsed) throw new Error('Invalid response when saving delivery mode')
  invalidateFunctionInvestmentTypeDetailsCache(function_master_id)
  return parsed
}

/**
 * Resolve Ownership vs Outsourcing from preference + FunctionInvestmentType.
 * Preference-first: only hit Nest for the active mode (or show modal if unset).
 */
export async function resolveDeliveryModeFromApi(
  mineId: string,
  functionMasterId: string,
): Promise<'ownership' | 'outsourcing' | null> {
  const id = functionMasterId.trim()
  const mine = mineId.trim()
  if (!id || !mine) return null

  const preferred = getPreferredDeliveryMode(mine, id)
  if (preferred === 'outsourcing') return 'outsourcing'
  if (preferred === 'ownership') {
    const ownership = await getFunctionInvestmentTypeDetails(id, 'ownership')
    return ownership ? 'ownership' : null
  }

  // No preference yet — do not probe all FIT types; let the delivery modal ask.
  return null
}

/**
 * Persist delivery mode choice for this mine + function.
 * Ownership → ensure ownership FIT exists (create only if missing).
 * Outsourcing → stores preference only; create runs when the user saves
 * Partial/Full/Adhoc config details.
 */
export async function persistDeliveryModeChoice(
  mineId: string,
  functionMasterId: string,
  mode: 'ownership' | 'outsourcing',
): Promise<void> {
  setPreferredDeliveryMode(mineId, functionMasterId, mode)
  invalidateFunctionInvestmentTypeDetailsCache(functionMasterId)
  if (mode === 'ownership') {
    await ensureFunctionInvestmentTypeStub(functionMasterId, 'ownership')
  }
}

/** Ensure a FunctionInvestmentType stub exists (Ownership / Adhoc / etc.). */
export async function ensureFunctionInvestmentTypeStub(
  functionMasterId: string,
  investmentType: InvestmentTypeSlug,
): Promise<FunctionInvestmentTypeRecord> {
  const existing = await getFunctionInvestmentTypeDetails(
    functionMasterId,
    investmentType,
  )
  if (existing) return existing
  try {
    return await createInvestmentTypeStub(functionMasterId, investmentType)
  } catch (error) {
    // Nest uniqueness: another client/tab may have created it between get and create.
    const message = error instanceof Error ? error.message : String(error)
    if (/already exists/i.test(message)) {
      invalidateFunctionInvestmentTypeDetailsCache(functionMasterId)
      const raced = await getFunctionInvestmentTypeDetails(
        functionMasterId,
        investmentType,
      )
      if (raced) return raced
    }
    throw error
  }
}

/** Ensure an adhoc-outsourcing stub exists for Adhoc cost-item isolation. */
export async function ensureAdhocOutsourcingStub(
  functionMasterId: string,
): Promise<FunctionInvestmentTypeRecord> {
  return ensureFunctionInvestmentTypeStub(functionMasterId, 'adhoc-outsourcing')
}
