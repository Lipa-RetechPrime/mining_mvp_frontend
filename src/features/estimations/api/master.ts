import { BackendApiError, fetchFromBackend } from '@/features/estimations/api/client'
import { ENDPOINTS } from '@/features/estimations/api/endpoints'
import type { EntityMaster, PhaseTypeMaster, Sector } from '../types/estimation'
import { buildPhaseTypeCatalog } from '../phases/phaseTypes'

/** @deprecated Prefer mine-wise function list from the API. Kept for legacy create fallbacks. */
// export const SECTOR_CATALOG: Sector[] = [
//   { id: 'residential-buildings', name: 'Residential buildings' },
//   { id: 'commercial-buildings', name: 'Commercial buildings' },
//   { id: 'industrial-buildings', name: 'Industrial buildings' },
//   { id: 'agricultural-buildings', name: 'Agricultural buildings' },
//   { id: 'other-buildings', name: 'Other buildings' },
// ]

export type MineFunctionEntity = {
  entity_master_id: string
  entity_name: string
}

export type MineFunction = {
  function_master_id: string
  function_name: string
  entities: MineFunctionEntity[]
}

type MineFunctionListResponse = {
  success?: boolean
  statusCode?: number
  message?: string
  data?: MineFunction[]
  count?: number
}

/** Map API functions into the Sector shape used by nav / estimation (?sector=). */
export function mineFunctionsToSectors(functions: MineFunction[]): Sector[] {
  return functions.map((fn) => ({
    id: fn.function_master_id,
    name: fn.function_name,
  }))
}

export async function getMineWiseFunctionList(
  mineId: string,
): Promise<MineFunction[]> {
  const trimmed = mineId.trim()
  if (!trimmed) return []

  try {
    const data = await fetchFromBackend<MineFunctionListResponse>(
      ENDPOINTS.investments.mineWiseFunctionList,
      {
        method: 'POST',
        json: { mine_id: trimmed },
      },
    )
    if (data.success === false) {
      if (data.statusCode === 404) return []
      throw new Error(data.message || 'Failed to load mine functions')
    }
    return Array.isArray(data.data) ? data.data : []
  } catch (error) {
    if (error instanceof BackendApiError && error.status === 404) {
      return []
    }
    throw error
  }
}

export async function getSectors(mineId?: string): Promise<Sector[]> {
  if (mineId?.trim()) {
    return mineFunctionsToSectors(await getMineWiseFunctionList(mineId))
  }
  return []
}

export async function getEntities(sectorId: string): Promise<EntityMaster[]> {
  if (!sectorId.trim()) return []
  // Entities also arrive on mine-wise function list; ECL/MDO retained as create fallback.
  return [
    { id: 'ecl', code: 'ECL', sectorId },
    { id: 'mdo', code: 'MDO', sectorId },
  ]
}

export async function getPhaseTypes(): Promise<PhaseTypeMaster[]> {
  return buildPhaseTypeCatalog()
}
