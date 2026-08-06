import { BackendApiError, fetchFromBackend } from '@/features/estimations/api/client'
import { ENDPOINTS } from '@/features/estimations/api/endpoints'
import type { ApiResponse } from '@/features/estimations/api/investments/types'

export type CreatePercentagePayload = {
  mine_id: string
  entity_id: string
  percentage: number
}

export type UpdatePercentagePayload = {
  percentage_master_id: string
  mine_id: string
  entity_id: string
  percentage: number
}

export type PercentageRecord = {
  percentage_master_id: string
  mine_id: string
  entity_id: string
  percentage: number
}

function normalizePercent(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error('Percentage must be a non-negative number')
  }
  // PercentageMaster.percentage is Int in the DB.
  return Math.round(percent)
}

function readApiMessage(error: unknown, fallback: string): string {
  if (error instanceof BackendApiError) return error.message || fallback
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function parsePercentageRecord(
  data: ApiResponse['data'],
  fallback: CreatePercentagePayload | UpdatePercentagePayload,
): PercentageRecord | null {
  const rows = Array.isArray(data) ? data : data ? [data] : []
  const row = rows.find(
    (item) =>
      item &&
      typeof item === 'object' &&
      (Boolean((item as { percentage_master_id?: string }).percentage_master_id) ||
        Boolean((item as { entity_id?: string }).entity_id)),
  ) as
    | {
        percentage_master_id?: string
        mine_id?: string
        entity_id?: string
        percentage?: number
      }
    | undefined

  const percentage_master_id = row?.percentage_master_id?.trim()
  if (!percentage_master_id) return null

  return {
    percentage_master_id,
    mine_id: row?.mine_id?.trim() || fallback.mine_id,
    entity_id: row?.entity_id?.trim() || fallback.entity_id,
    percentage:
      row?.percentage != null && Number.isFinite(Number(row.percentage))
        ? Number(row.percentage)
        : fallback.percentage,
  }
}

/** GET /investments/get-percentage/:mineId/:entityId */
export async function getPercentage(
  mineId: string,
  entityId: string,
): Promise<PercentageRecord | null> {
  const mine_id = mineId?.trim()
  const entity_id = entityId?.trim()
  if (!mine_id || !entity_id) return null
  try {
    const data = await fetchFromBackend<ApiResponse>(
      `${ENDPOINTS.investments.getPercentage}/${mine_id}/${entity_id}`,
    )
    if (data.success === false) return null
    return parsePercentageRecord(data.data, { mine_id, entity_id, percentage: 0 })
  } catch {
    return null
  }
}

/** POST /investments/create-percentage */
export async function createPercentage(
  payload: CreatePercentagePayload,
): Promise<PercentageRecord | null> {
  const mine_id = payload.mine_id?.trim()
  const entity_id = payload.entity_id?.trim()
  if (!mine_id) throw new Error('mine_id is required')
  if (!entity_id) throw new Error('entity_id is required')

  const percentage = normalizePercent(payload.percentage)
  try {
    const data = await fetchFromBackend<ApiResponse>(ENDPOINTS.investments.createPercentage, {
      method: 'POST',
      json: {
        mine_id,
        entity_id,
        percentage,
      },
    })
    if (data.success === false) {
      if (/already exists/i.test(data.message || '') || data.statusCode === 409) {
        const existing = await getPercentage(mine_id, entity_id)
        if (existing?.percentage_master_id) {
          return updatePercentage({
            percentage_master_id: existing.percentage_master_id,
            mine_id,
            entity_id,
            percentage,
          })
        }
      }
      throw new Error(data.message || 'Failed to create percentage')
    }
    return parsePercentageRecord(data.data, { mine_id, entity_id, percentage })
  } catch (error) {
    // Percentage routes may be missing on the current Nest build.
    if (error instanceof BackendApiError && (error.status === 404 || error.status === 501)) {
      return null
    }
    const message = readApiMessage(error, 'Failed to create percentage')
    if (/cannot post/i.test(message) || /not found/i.test(message)) {
      return null
    }
    if (
      /already exists/i.test(message) ||
      (error instanceof BackendApiError && error.status === 409)
    ) {
      const existing = await getPercentage(mine_id, entity_id)
      if (existing?.percentage_master_id) {
        return updatePercentage({
          percentage_master_id: existing.percentage_master_id,
          mine_id,
          entity_id,
          percentage,
        })
      }
    }
    throw new Error(message)
  }
}

/** PUT /investments/update-percentage */
export async function updatePercentage(
  payload: UpdatePercentagePayload,
): Promise<PercentageRecord | null> {
  const percentage_master_id = payload.percentage_master_id?.trim()
  const mine_id = payload.mine_id?.trim()
  const entity_id = payload.entity_id?.trim()
  if (!percentage_master_id) throw new Error('percentage_master_id is required')
  if (!mine_id) throw new Error('mine_id is required')
  if (!entity_id) throw new Error('entity_id is required')

  const percentage = normalizePercent(payload.percentage)
  try {
    const data = await fetchFromBackend<ApiResponse>(ENDPOINTS.investments.updatePercentage, {
      method: 'PUT',
      json: {
        percentage_master_id,
        mine_id,
        entity_id,
        percentage,
      },
    })
    if (data.success === false) {
      throw new Error(data.message || 'Failed to update percentage')
    }
    return (
      parsePercentageRecord(data.data, {
        percentage_master_id,
        mine_id,
        entity_id,
        percentage,
      }) ?? {
        percentage_master_id,
        mine_id,
        entity_id,
        percentage,
      }
    )
  } catch (error) {
    if (error instanceof BackendApiError && (error.status === 404 || error.status === 501)) {
      return null
    }
    const message = readApiMessage(error, 'Failed to update percentage')
    if (/cannot put/i.test(message) || /not found/i.test(message)) {
      return null
    }
    throw new Error(message)
  }
}

export type EntityPercentageTarget = {
  entity_id: string
  percentage_master_id?: string | null
  percentage: number
}

/**
 * Create or update percentage for each entity (each target may have its own %).
 * Returns map of entity_id → percentage_master_id from API responses.
 */
export async function savePercentagesForEntities(
  mineId: string,
  targets: EntityPercentageTarget[],
): Promise<Record<string, string>> {
  const mine_id = mineId?.trim()
  if (!mine_id) throw new Error('mine_id is required')
  if (targets.length === 0) {
    throw new Error('No entity ids available to save percentage')
  }

  const masterIds: Record<string, string> = {}
  const errors: string[] = []

  for (const target of targets) {
    const entity_id = target.entity_id?.trim()
    if (!entity_id) continue

    try {
      const percentage = normalizePercent(target.percentage)
      const masterId = target.percentage_master_id?.trim()
      if (masterId) {
        const updated = await updatePercentage({
          percentage_master_id: masterId,
          mine_id,
          entity_id,
          percentage,
        })
        masterIds[entity_id] = updated?.percentage_master_id ?? masterId
      } else {
        const created = await createPercentage({
          mine_id,
          entity_id,
          percentage,
        })
        if (created?.percentage_master_id) {
          masterIds[entity_id] = created.percentage_master_id
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (errors.length > 0) {
    throw new Error(errors[0] || 'Failed to save percentage')
  }

  return masterIds
}

export type MinePercentagesResponse = {
  success?: boolean
  statusCode?: number
  message?: string
  data?: PercentageRecord[] | unknown
}

/** GET /percentages/get-all/:mineId */
export async function getPercentagesByMine(
  mineId: string,
): Promise<PercentageRecord[]> {
  const mine_id = mineId?.trim()
  if (!mine_id) return []

  const data = await fetchFromBackend<MinePercentagesResponse>(
    `${ENDPOINTS.investments.percentagesGetAll}/${mine_id}`,
  )
  if (data.success === false) {
    throw new Error(data.message || 'Failed to load percentages for mine')
  }

  const rows = Array.isArray(data.data) ? data.data : []
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const record = row as {
        percentage_master_id?: string
        mine_id?: string
        entity_id?: string
        percentage?: number
      }
      const percentage_master_id = record.percentage_master_id?.trim()
      const entity_id = record.entity_id?.trim()
      if (!percentage_master_id || !entity_id) return null
      return {
        percentage_master_id,
        mine_id: record.mine_id?.trim() || mine_id,
        entity_id,
        percentage:
          record.percentage != null && Number.isFinite(Number(record.percentage))
            ? Number(record.percentage)
            : 0,
      } satisfies PercentageRecord
    })
    .filter((row): row is PercentageRecord => row != null)
}
