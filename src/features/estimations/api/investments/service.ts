import { BackendApiError, fetchBlobFromBackend, fetchFromBackend } from '@/features/estimations/api/client'
import { ENDPOINTS } from '../endpoints'
import { getEntities } from '../master'
import { savePercentagesForEntities } from './electrification'
import {
  ensureEntityTabs,
  mapDtoToEstimation,
  mapEstimationToDto,
  withDerivedAutomaticPercentages,
  withMasterEntityTabs,
} from './mappers'
import {
  appendCostItem,
  cleanUuid,
  isStepPopulated,
  isUuid,
  removeCostItem,
  withApiIds,
} from './domain'
import { validateEstimation, isValid } from '../../utils/validation'
import { generateUuid } from '@/shared/utils/uuid'
import { compareEntityCodes } from '../../constants/entityTabs'
import type {
  ApiResponse,
  InvestmentListResponse,
  OverallListData,
  OverallListResponse,
} from './types'
import type { Estimation, Step } from '../../types/estimation'

export function assertApiSuccess(
  response: { success?: boolean; message?: string },
  fallbackMessage: string,
) {
  if (response.success === false) {
    throw new Error(response.message || fallbackMessage)
  }
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BackendApiError) {
    return error.message || fallback
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** Coalesce concurrent list fetches and briefly reuse the result after mutations. */
let listInflight: Promise<Estimation[]> | null = null
let listCache: { at: number; data: Estimation[] } | null = null
const LIST_CACHE_TTL_MS = 800

export function invalidateEstimationsListCache(): void {
  listCache = null
  listInflight = null
  invalidateOverallListCache()
}

export async function fetchInvestments(): Promise<Estimation[]> {
  const data = await fetchFromBackend<InvestmentListResponse>(ENDPOINTS.investments.list)
  assertApiSuccess(data, 'Failed to load estimations')
  return (data.data ?? []).map(mapDtoToEstimation)
}

export async function listEstimations(): Promise<Estimation[]> {
  if (listCache && Date.now() - listCache.at < LIST_CACHE_TTL_MS) {
    return listCache.data
  }
  if (listInflight) return listInflight

  listInflight = (async () => {
    const list = (await fetchInvestments()).map(withDerivedAutomaticPercentages)
    const withTabs = await Promise.all(list.map(withMasterEntityTabs))
    listCache = { at: Date.now(), data: withTabs }
    return withTabs
  })().finally(() => {
    listInflight = null
  })

  return listInflight
}

export async function getEstimation(id: string): Promise<Estimation> {
  const item = (await listEstimations()).find(
    (estimation) => estimation.id === id || estimation.mine_id === id,
  )
  if (!item) throw new Error('Estimation not found')
  const base = withDerivedAutomaticPercentages(item)
  return {
    ...base,
    electrificationPercentByEntity: base.electrificationPercentByEntity ?? {},
    percentageMasterIdByEntity: base.percentageMasterIdByEntity ?? {},
  }
}

export async function createMineYear(mineId: string, year: number): Promise<void> {
  try {
    const data = await fetchFromBackend<ApiResponse>(ENDPOINTS.investments.createMineYear, {
      method: 'POST',
      json: {
        mine_id: mineId,
        year,
      },
    })
    if (data.success === false && data.statusCode !== 409) {
      throw new Error(data.message || 'Failed to save mine phase limit')
    }
  } catch (error) {
    // Current Nest build may not expose this route yet — do not fail the whole submit.
    if (error instanceof BackendApiError && (error.status === 404 || error.status === 501)) {
      return
    }
    const message = apiErrorMessage(error, 'Failed to save mine phase limit')
    if (
      /already exists/i.test(message) ||
      /409/.test(message) ||
      /cannot post/i.test(message) ||
      /not found/i.test(message)
    ) {
      return
    }
    throw new Error(message)
  }
}

async function persistMinePhaseLimit(estimation: Estimation): Promise<void> {
  const mineId = estimation.mine_id
  const year = estimation.phaseLimit
  if (!mineId || year == null || !Number.isFinite(year) || year <= 0) return
  await createMineYear(mineId, Math.floor(year))
}

function entityIdsMatch(left: string, right: string): boolean {
  if (left === right) return true
  return cleanUuid(left) === cleanUuid(right)
}

function findEntityTab(estimation: Estimation, entityId: string) {
  for (const block of estimation.blocks) {
    for (const tab of block.entityTabs) {
      if (entityIdsMatch(tab.entityId, entityId)) return tab
    }
  }
  return undefined
}

function resolvePercentForTab(
  estimation: Estimation,
  tab: { entityId: string; entityCode: string },
  percentByEntity: Record<string, number>,
): number | null {
  const keys = new Set<string>([tab.entityId, cleanUuid(tab.entityId)])
  for (const key of keys) {
    const value = percentByEntity[key]
    if (value != null && Number.isFinite(value) && value >= 0) return value
  }
  const code = tab.entityCode.trim().toLowerCase()
  for (const block of estimation.blocks) {
    for (const candidate of block.entityTabs) {
      if (candidate.entityCode.trim().toLowerCase() !== code) continue
      const value = percentByEntity[candidate.entityId]
      if (value != null && Number.isFinite(value) && value >= 0) return value
    }
  }
  return null
}

function resolvePersistEntityId(
  tab: { entityId: string; entityCode: string },
  latestTabs: Array<{ entityId: string; entityCode: string }>,
): string | null {
  if (isUuid(tab.entityId)) return cleanUuid(tab.entityId)
  const code = tab.entityCode.trim().toLowerCase()
  const fromLatest = latestTabs.find(
    (candidate) =>
      candidate.entityCode.trim().toLowerCase() === code && isUuid(candidate.entityId),
  )
  if (fromLatest) return cleanUuid(fromLatest.entityId)
  return isUuid(tab.entityId) ? cleanUuid(tab.entityId) : null
}

function assertEstimationValidForSave(estimation: Estimation): void {
  const errors = validateEstimation(estimation)
  if (isValid(errors)) return
  const messages = Object.values(errors)
  throw new Error(messages[0] ?? 'Validation failed')
}

function isInvestmentsListUnavailable(error: unknown): boolean {
  const message = apiErrorMessage(error, '')
  if (/Failed to retrieve investments|EntityFunction|not associated/i.test(message)) {
    return true
  }
  return error instanceof BackendApiError && (error.status === 500 || error.status === 501)
}

/** Prefer list data when available; tolerate Nest get-all-list association failures. */
async function findEstimationInList(mineId: string): Promise<Estimation | undefined> {
  try {
    invalidateEstimationsListCache()
    return (await listEstimations()).find(
      (item) => item.mine_id === mineId || item.id === mineId,
    )
  } catch (error) {
    if (isInvestmentsListUnavailable(error)) return undefined
    throw error
  }
}

async function persistElectrificationPercent(
  estimation: Estimation,
  preferredEntityIds: string[] = [],
): Promise<Record<string, string>> {
  const mineId = estimation.mine_id
  if (!mineId) return estimation.percentageMasterIdByEntity ?? {}

  const latest = await findEstimationInList(mineId)
  const latestTabs = latest?.blocks[0]?.entityTabs ?? []
  const knownMasters = {
    ...(latest?.percentageMasterIdByEntity ?? {}),
    ...(estimation.percentageMasterIdByEntity ?? {}),
  }
  const percentByEntity = {
    ...(latest?.electrificationPercentByEntity ?? {}),
    ...(estimation.electrificationPercentByEntity ?? {}),
  }

  const targets: Array<{
    entity_id: string
    percentage_master_id: string | null
    percentage: number
  }> = []

  const seen = new Set<string>()
  for (const block of estimation.blocks) {
    for (const tab of block.entityTabs) {
      if (!tab.steps.some(isStepPopulated)) continue

      const entity_id = resolvePersistEntityId(tab, latestTabs)
      if (!entity_id || seen.has(entity_id)) continue

      const percentage = resolvePercentForTab(estimation, tab, percentByEntity)
      if (percentage == null) {
        throw new Error(
          `Design / electrification percent is required for ${tab.entityCode || entity_id}`,
        )
      }
      seen.add(entity_id)
      targets.push({
        entity_id,
        percentage_master_id:
          knownMasters[entity_id] ??
          knownMasters[tab.entityId] ??
          null,
        percentage,
      })
    }
  }

  for (const entity_id of preferredEntityIds) {
    if (!isUuid(entity_id) || seen.has(cleanUuid(entity_id))) continue
    const cleaned = cleanUuid(entity_id)
    const tab =
      findEntityTab(estimation, cleaned) ??
      latestTabs.find((t) => entityIdsMatch(t.entityId, cleaned))
    if (!tab?.steps.some(isStepPopulated)) continue
    const percentage = tab
      ? resolvePercentForTab(estimation, tab, percentByEntity)
      : null
    if (percentage == null) continue
    seen.add(cleaned)
    targets.push({
      entity_id: cleaned,
      percentage_master_id: knownMasters[cleaned] ?? null,
      percentage,
    })
  }

  if (targets.length === 0) return knownMasters

  try {
    const savedMasters = await savePercentagesForEntities(mineId, targets)
    return { ...knownMasters, ...savedMasters }
  } catch (error) {
    // Percentage routes may be missing on the current Nest build.
    if (error instanceof BackendApiError && (error.status === 404 || error.status === 501)) {
      return knownMasters
    }
    const message = apiErrorMessage(error, 'Failed to save percentage')
    if (/cannot post/i.test(message) || /cannot put/i.test(message) || /not found/i.test(message)) {
      return knownMasters
    }
    throw error instanceof Error ? error : new Error(message)
  }
}

function isDuplicateMineNameError(message: string, statusCode?: number): boolean {
  if (statusCode === 409) return true
  return /already exists|duplicate/i.test(message)
}

async function updateExistingMineByName(body: Estimation): Promise<Estimation> {
  const name = (body.siteSubtitle || '').trim().toLowerCase()
  if (!name) {
    throw new Error('A mine profile with this name already exists')
  }

  const fromBody =
    body.mine_id || (body.id && isUuid(body.id) ? cleanUuid(body.id) : undefined)

  let existing: Estimation | undefined
  let mineId = fromBody
  if (!mineId) {
    try {
      invalidateEstimationsListCache()
      existing = (await listEstimations()).find(
        (item) => (item.siteSubtitle || '').trim().toLowerCase() === name,
      )
      mineId = existing?.mine_id || existing?.id
    } catch (error) {
      if (isInvestmentsListUnavailable(error)) {
        throw new Error(
          `A mine profile with the name '${body.siteSubtitle}' already exists, but the investments list API failed (${apiErrorMessage(error, 'unknown error')}). Restart Nest after fixing EntityFunction associations, then open the existing mine to edit.`,
        )
      }
      throw error
    }
  }

  if (!mineId) {
    throw new Error(
      `A mine profile with the name '${body.siteSubtitle}' already exists, but it could not be loaded for update.`,
    )
  }
  return updateEstimation(mineId, {
    ...body,
    id: mineId,
    mine_id: mineId,
    percentageMasterIdByEntity:
      body.percentageMasterIdByEntity ?? existing?.percentageMasterIdByEntity ?? {},
  })
}

export async function createEstimation(body: Estimation): Promise<Estimation> {
  invalidateEstimationsListCache()
  const id = body.id || `est-${generateUuid()}`
  const now = new Date().toISOString()
  const prepared: Estimation = withApiIds({
    ...body,
    id,
    createdAt: now,
    updatedAt: now,
  })

  const orderedPrepared = ensureEntityTabs(
    prepared,
    await getEntities(prepared.blocks[0]?.sectorId || 'residential-buildings'),
  )

  const payload = mapEstimationToDto(orderedPrepared, 'create')
  let data: ApiResponse
  try {
    data = await fetchFromBackend<ApiResponse>(ENDPOINTS.investments.create, {
      method: 'POST',
      json: payload,
    })
    if (
      data.success === false &&
      isDuplicateMineNameError(String(data.message ?? ''), data.statusCode)
    ) {
      return updateExistingMineByName(orderedPrepared)
    }
    assertApiSuccess(data, 'Failed to create estimation')
  } catch (error) {
    const message = apiErrorMessage(error, 'Failed to create estimation')
    const statusCode = error instanceof BackendApiError ? error.status : undefined
    if (isDuplicateMineNameError(message, statusCode)) {
      return updateExistingMineByName(orderedPrepared)
    }
    throw error instanceof Error ? error : new Error(message)
  }

  const createdRows = Array.isArray(data.data) ? data.data : data.data ? [data.data] : []
  const mine_id = createdRows.find((row) => row.mine_id)?.mine_id
  if (!mine_id) {
    throw new Error('Create response did not include mine_id')
  }

  const entityIdsFromCreate: string[] = []
  for (const row of createdRows) {
    if (typeof row.entity_id !== 'string' || !isUuid(row.entity_id)) continue
    const entityId = cleanUuid(row.entity_id)
    if (!entityIdsFromCreate.includes(entityId)) entityIdsFromCreate.push(entityId)
  }

  let rowIndex = 0
  let entityCursor = 0
  let electrificationPercentByEntity = {
    ...(orderedPrepared.electrificationPercentByEntity ?? {}),
  }
  const syncedBlocks = orderedPrepared.blocks.map((block) => {
    const entityTabs = block.entityTabs.map((tab) => {
      const hasPopulated = tab.steps.some(isStepPopulated)
      const previousEntityId = tab.entityId
      let entityId = isUuid(tab.entityId) ? cleanUuid(tab.entityId) : tab.entityId
      if (hasPopulated && !isUuid(entityId) && entityIdsFromCreate[entityCursor]) {
        entityId = entityIdsFromCreate[entityCursor]
        entityCursor += 1
      }
      if (
        previousEntityId !== entityId &&
        electrificationPercentByEntity[previousEntityId] != null &&
        electrificationPercentByEntity[entityId] == null
      ) {
        electrificationPercentByEntity = {
          ...electrificationPercentByEntity,
          [entityId]: electrificationPercentByEntity[previousEntityId],
        }
        delete electrificationPercentByEntity[previousEntityId]
      }
      return {
        ...tab,
        entityId,
        steps: tab.steps.map((step) => {
          if (!isStepPopulated(step)) return step
          const serverId = createdRows[rowIndex]?.cost_item_id
          rowIndex += 1
          return serverId ? { ...step, id: serverId } : step
        }),
      }
    })
    const activeStillValid = entityTabs.some((tab) => tab.entityId === block.activeEntityId)
    return {
      ...block,
      entityTabs,
      activeEntityId: activeStillValid
        ? block.activeEntityId
        : (entityTabs.find((tab) => isUuid(tab.entityId))?.entityId ?? block.activeEntityId),
    }
  })

  const created: Estimation = {
    ...orderedPrepared,
    id: mine_id,
    mine_id,
    blocks: syncedBlocks,
    phaseLimit: orderedPrepared.phaseLimit,
    electrificationPercentByEntity,
    percentageMasterIdByEntity: orderedPrepared.percentageMasterIdByEntity ?? {},
  }
  await persistMinePhaseLimit(created)
  const percentageMasterIdByEntity = await persistElectrificationPercent(
    created,
    entityIdsFromCreate,
  )
  invalidateEstimationsListCache()
  return { ...created, percentageMasterIdByEntity }
}

export async function updateEstimation(id: string, body: Estimation): Promise<Estimation> {
  const mine_id = body.mine_id || id
  if (!mine_id) {
    throw new Error('Estimation is missing mine_id')
  }

  const orderedBody = ensureEntityTabs(
    body,
    await getEntities(body.blocks[0]?.sectorId || 'residential-buildings'),
  )

  const updated: Estimation = withApiIds({
    ...orderedBody,
    id: mine_id,
    mine_id,
    phaseLimit: orderedBody.phaseLimit ?? null,
    electrificationPercentByEntity: orderedBody.electrificationPercentByEntity ?? {},
    percentageMasterIdByEntity: orderedBody.percentageMasterIdByEntity ?? {},
    updatedAt: new Date().toISOString(),
  })

  assertEstimationValidForSave(updated)

  const payload = mapEstimationToDto(updated, 'update')
  try {
    invalidateEstimationsListCache()
    const data = await fetchFromBackend<ApiResponse>(ENDPOINTS.investments.update, {
      method: 'PUT',
      json: payload,
    })
    assertApiSuccess(data, 'Failed to update estimation')
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Failed to update estimation'))
  }

  await persistMinePhaseLimit(updated)
  const percentageMasterIdByEntity = await persistElectrificationPercent(updated)
  invalidateEstimationsListCache()

  return withMasterEntityTabs({ ...updated, percentageMasterIdByEntity })
}

export async function deleteEstimation(id: string): Promise<void> {
  const estimation = await getEstimation(id)
  const mine_id = estimation.mine_id

  if (mine_id) {
    invalidateEstimationsListCache()
    try {
      const data = await fetchFromBackend<ApiResponse>(ENDPOINTS.investments.deleteMine, {
        method: 'DELETE',
        json: { mine_id },
      })
      if (data.success === false && data.statusCode !== 404) {
        throw new Error(data.message || 'Failed to delete estimation')
      }
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        // already deleted
      } else {
        throw new Error(apiErrorMessage(error, 'Failed to delete estimation'))
      }
    }
  }
  invalidateEstimationsListCache()
}

export async function addCostItemToEstimation(
  estimationId: string,
  entityId: string,
  step: Step,
): Promise<Estimation> {
  return addCostItemsToEstimation(estimationId, entityId, [step])
}

export async function addCostItemsToEstimation(
  estimationId: string,
  entityId: string,
  steps: Step[],
  currentEstimation?: Estimation,
  electrificationPercent?: number | null,
): Promise<Estimation> {
  const current =
    currentEstimation &&
    (currentEstimation.id === estimationId || currentEstimation.mine_id === estimationId)
      ? currentEstimation
      : await getEstimation(estimationId)

  const populatedSteps = steps.filter(isStepPopulated)
  if (populatedSteps.length > 0) {
    if (
      electrificationPercent == null ||
      !Number.isFinite(electrificationPercent) ||
      electrificationPercent < 0
    ) {
      const tab = findEntityTab(current, entityId)
      throw new Error(
        `Design / electrification percent is required for ${tab?.entityCode ?? 'this entity'}`,
      )
    }
  }

  let next = populatedSteps.reduce(
    (acc, step) => appendCostItem(acc, entityId, step),
    current,
  )

  const masters = await getEntities(next.blocks[0]?.sectorId || 'residential-buildings')
  next = ensureEntityTabs(next, masters)

  if (populatedSteps.length > 0) {
    const targetTab = findEntityTab(next, entityId)
    const percentKey = targetTab?.entityId ?? entityId
    next = {
      ...next,
      electrificationPercentByEntity: {
        ...(next.electrificationPercentByEntity ?? {}),
        [percentKey]: electrificationPercent as number,
      },
    }
  }

  return updateEstimation(estimationId, next)
}

export async function removeCostItemFromEstimation(
  estimationId: string,
  entityId: string,
  stepId: string,
): Promise<Estimation> {
  const current = await getEstimation(estimationId)
  const mine_id = current.mine_id
  if (!mine_id) {
    throw new Error('Estimation is missing mine_id')
  }

  const cost_item_id = cleanUuid(stepId)
  try {
    const data = await fetchFromBackend<ApiResponse>(ENDPOINTS.investments.deleteCostItem, {
      method: 'DELETE',
      json: { cost_item_id, mine_id },
    })
    if (data.success === false && data.statusCode !== 404) {
      throw new Error(data.message || 'Failed to delete cost item')
    }
  } catch (error) {
    if (!(error instanceof BackendApiError && error.status === 404)) {
      throw new Error(apiErrorMessage(error, 'Failed to delete cost item'))
    }
  }

  const next = removeCostItem(current, entityId, stepId)
  return withMasterEntityTabs({
    ...next,
    id: estimationId,
    mine_id,
    updatedAt: new Date().toISOString(),
  })
}

function filenameFromContentDisposition(header: string | undefined): string | null {
  if (!header) return null
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim())
    } catch {
      return utf8Match[1].trim()
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header)
  return plainMatch?.[1]?.trim() || null
}

async function readDownloadErrorMessage(error: unknown): Promise<string> {
  if (error instanceof BackendApiError) {
    if (error.status === 404) {
      return 'Mine not found for this estimation. Create/save it on the server first, then download.'
    }
    return error.message || 'Failed to download Excel. Please try again.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Failed to download Excel. Please try again.'
}

export async function downloadEstimationExcel(mineId: string): Promise<void> {
  if (!mineId) {
    throw new Error('Estimation is missing mine_id')
  }
  try {
    const { blob, headers } = await fetchBlobFromBackend(
      ENDPOINTS.investments.downloadExcel,
      {
        method: 'POST',
        json: { mine_id: mineId },
      },
    )

    const filename =
      filenameFromContentDisposition(headers.get('content-disposition') ?? undefined) ||
      `investment-${mineId}.xlsx`

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    throw new Error(await readDownloadErrorMessage(error))
  }
}

/** Coalesce concurrent overall-list fetches and briefly reuse the result. */
const overallInflight = new Map<string, Promise<OverallListData>>()
const overallCache = new Map<string, { at: number; data: OverallListData }>()
const OVERALL_CACHE_TTL_MS = 1500

export function invalidateOverallListCache(mineId?: string): void {
  if (mineId) {
    overallInflight.delete(mineId)
    overallCache.delete(mineId)
    return
  }
  overallInflight.clear()
  overallCache.clear()
}

export async function fetchOverallList(mineId: string): Promise<OverallListData> {
  if (!mineId) {
    throw new Error('Estimation is missing mine_id')
  }

  const cached = overallCache.get(mineId)
  if (cached && Date.now() - cached.at < OVERALL_CACHE_TTL_MS) {
    return cached.data
  }

  const existing = overallInflight.get(mineId)
  if (existing) return existing

  const request = (async () => {
    const data = await fetchFromBackend<OverallListResponse>(
      ENDPOINTS.investments.overallList,
      {
        method: 'POST',
        json: { mine_id: mineId },
      },
    )
    assertApiSuccess(data, 'Failed to load overall list')
    if (!data.data) {
      throw new Error(data.message || 'Overall list response did not include data')
    }

    const fromEntities = data.data.entities
      ?.map((entity) => {
        const raw =
          entity.percentage ??
          (entity as { design_percentage?: number | null }).design_percentage
        return raw
      })
      .find((value) => value != null && Number.isFinite(Number(value)))

    const electrification_percent =
      data.data.electrification_percent != null &&
      Number.isFinite(Number(data.data.electrification_percent))
        ? Number(data.data.electrification_percent)
        : fromEntities != null
          ? Number(fromEntities)
          : null

    const entities = [...(data.data.entities ?? [])]
      .map((entity) => {
        const percentage =
          entity.percentage != null && Number.isFinite(Number(entity.percentage))
            ? Number(entity.percentage)
            : (entity as { design_percentage?: number | null }).design_percentage != null &&
                Number.isFinite(
                  Number((entity as { design_percentage?: number | null }).design_percentage),
                )
              ? Number((entity as { design_percentage?: number | null }).design_percentage)
              : electrification_percent

        const designAmount =
          entity.design_percent != null && Number.isFinite(Number(entity.design_percent))
            ? Number(entity.design_percent)
            : (entity as { design_amount?: number | null }).design_amount != null
              ? Number((entity as { design_amount?: number | null }).design_amount)
              : (entity as { design_10_percent?: number | null }).design_10_percent != null
                ? Number((entity as { design_10_percent?: number | null }).design_10_percent)
                : entity.design_percent

        return {
          ...entity,
          percentage,
          design_percent: designAmount ?? entity.design_percent,
        }
      })
      .sort((a, b) => compareEntityCodes(a.entity_name, b.entity_name))

    const normalized: OverallListData = {
      ...data.data,
      entities,
      electrification_percent,
    }
    overallCache.set(mineId, { at: Date.now(), data: normalized })
    return normalized
  })().finally(() => {
    overallInflight.delete(mineId)
  })

  overallInflight.set(mineId, request)
  return request
}
