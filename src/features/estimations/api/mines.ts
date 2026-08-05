import { BackendApiError, fetchFromBackend } from '@/features/estimations/api/client'
import { ENDPOINTS } from '@/features/estimations/api/endpoints'

/** Raw mine row from mine list API (snake_case + common aliases). */
export type MineListDto = {
  mine_id?: string
  id?: string
  mine_name?: string
  name?: string
  /** Nest mine list uses `mine_year` (from operational years). */
  mine_year?: number | string | null
  year?: number | string | null
  years?: number | string | null
  phase_limit?: number | string | null
  updated_at?: string | null
  updatedAt?: string | null
  created_at?: string | null
  createdAt?: string | null
  [key: string]: unknown
}

export type MineListResponse = {
  success?: boolean
  statusCode?: number
  message?: string
  data?: MineListDto[]
  count?: number
}

/** Normalized mine for listing UI. */
export type MineListItem = {
  mine_id: string
  mine_name: string
  year: number | null
  updatedAt?: string
}

function parseOptionalYear(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}

export function mapMineListDto(dto: MineListDto): MineListItem | null {
  const mine_id = String(dto.mine_id ?? dto.id ?? '').trim()
  if (!mine_id) return null

  const mine_name =
    String(dto.mine_name ?? dto.name ?? '').trim() || 'Untitled mine'

  const year = parseOptionalYear(
    dto.mine_year ?? dto.year ?? dto.years ?? dto.phase_limit ?? null,
  )

  const updatedRaw = dto.updated_at ?? dto.updatedAt ?? undefined
  const updatedAt =
    typeof updatedRaw === 'string' && updatedRaw.trim()
      ? updatedRaw.trim()
      : undefined

  return { mine_id, mine_name, year, updatedAt }
}

const MINE_LIST_NOT_READY =
  'Mine list API is not available (GET /mines/list). Confirm Nest is running and MineController is registered.'

export async function listMines(): Promise<MineListItem[]> {
  try {
    // Explicit mines.list — never investments get-all-list.
    const data = await fetchFromBackend<MineListResponse>(ENDPOINTS.mines.list)
    if (data.success === false) {
      throw new Error(data.message || 'Failed to load mines')
    }
    const rows = Array.isArray(data.data) ? data.data : []
    return rows
      .map(mapMineListDto)
      .filter((row): row is MineListItem => row != null)
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      throw new Error(MINE_LIST_NOT_READY)
    }
    throw error
  }
}
