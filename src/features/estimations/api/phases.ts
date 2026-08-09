import { fetchFromBackend } from '@/features/estimations/api/client'
import { ENDPOINTS } from '@/features/estimations/api/endpoints'
import { normalizeCatalogPhaseCode } from '@/features/estimations/phases/phaseTypes'

type PhaseMasterRow = {
  phase_id?: string
  phase_master_id?: string
  phase_name?: string
}

type PhaseListResponse = {
  success?: boolean
  statusCode?: number
  message?: string
  data?: PhaseMasterRow[] | string[] | null
}

let phaseIdByNameCache: Map<string, string> | null = null
let phaseNameByIdCache: Map<string, string> | null = null
let phaseIdByNameLoad: Promise<Map<string, string>> | null = null

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readPhaseId(row: PhaseMasterRow): string {
  return String(row.phase_id ?? row.phase_master_id ?? '').trim()
}

function readPhaseName(row: PhaseMasterRow): string {
  return String(row.phase_name ?? '').trim()
}

function rebuildPhaseNameByIdCache(idByName: Map<string, string>): void {
  const nameById = new Map<string, string>()
  for (const [name, id] of idByName.entries()) {
    if (!nameById.has(id)) nameById.set(id, name)
  }
  phaseNameByIdCache = nameById
}

/** GET /phases/list — maps phase code (P4, C1) → PhaseMaster UUID. */
export async function loadPhaseIdByNameMap(): Promise<Map<string, string>> {
  if (phaseIdByNameCache) return phaseIdByNameCache
  if (!phaseIdByNameLoad) {
    phaseIdByNameLoad = (async () => {
      const data = await fetchFromBackend<PhaseListResponse>(ENDPOINTS.phases.list, {
        method: 'GET',
      })
      if (data.success === false) {
        throw new Error(data.message || 'Failed to load phase master list')
      }
      const map = new Map<string, string>()
      const rows = Array.isArray(data.data) ? data.data : []
      for (const row of rows) {
        if (typeof row === 'string') continue
        const name = readPhaseName(row)
        const id = readPhaseId(row)
        if (name && id) map.set(name.toUpperCase(), id)
      }
      if (map.size === 0) {
        throw new Error(
          'Phase master list returned no phase_id values. Nest GET /phases/list must return { phase_id, phase_name }[].',
        )
      }
      phaseIdByNameCache = map
      rebuildPhaseNameByIdCache(map)
      return map
    })().catch((error) => {
      phaseIdByNameLoad = null
      throw error
    })
  }
  return phaseIdByNameLoad
}

export async function loadPhaseNameByIdMap(): Promise<Map<string, string>> {
  await loadPhaseIdByNameMap()
  return phaseNameByIdCache ?? new Map()
}

export function resolvePhaseId(
  phaseName: string,
  phaseIdByName: Map<string, string>,
): string {
  const key = phaseName.trim()
  const id =
    phaseIdByName.get(key) ||
    phaseIdByName.get(key.toUpperCase()) ||
    phaseIdByName.get(key.toLowerCase())
  if (!id) {
    throw new Error(
      `No PhaseMaster id found for phase "${phaseName}". Ensure it exists in /phases/list.`,
    )
  }
  return id
}

/** Nest Full FIT expects UUID; UI uses catalog codes (P9). Accept either. */
export async function resolvePhaseIdFromCodeOrId(
  phaseCodeOrId: string,
): Promise<string> {
  const raw = phaseCodeOrId.trim()
  if (!raw) throw new Error('from_payback_start is required')
  if (UUID_RE.test(raw)) return raw
  const map = await loadPhaseIdByNameMap()
  return resolvePhaseId(raw, map)
}

/** UI / Overall overlays need codes — Nest may return from_payback_start as UUID. */
export async function resolvePhaseCodeFromIdOrName(
  phaseCodeOrId: string,
): Promise<string> {
  const raw = phaseCodeOrId.trim()
  if (!raw) return raw
  const alreadyCode = normalizeCatalogPhaseCode(raw)
  if (alreadyCode) return alreadyCode
  if (!UUID_RE.test(raw)) {
    // Non-UUID label — last chance to pull an embedded C#/P# token.
    return alreadyCode ?? raw
  }
  const nameById = await loadPhaseNameByIdMap()
  const name = nameById.get(raw)?.trim()
  if (!name) {
    throw new Error(
      `No phase_name found for phase id "${raw}". Ensure /phases/list returns { phase_id, phase_name }.`,
    )
  }
  const code = normalizeCatalogPhaseCode(name)
  if (!code) {
    throw new Error(
      `Phase master "${name}" (id ${raw}) is not a catalog code (C1/P1…).`,
    )
  }
  return code
}

export function invalidatePhaseIdByNameCache(): void {
  phaseIdByNameCache = null
  phaseNameByIdCache = null
  phaseIdByNameLoad = null
}
