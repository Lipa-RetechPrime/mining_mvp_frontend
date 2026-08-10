/**
 * When Nest get-all-list omits function_investment_type_id, remember which FIT
 * each cost item was saved under so Ownership / Partial / Full / Adhoc stay isolated.
 * Does NOT fix Nest wiping peer FIT rows on update — that requires backend scoped deletes.
 */
const STORAGE_KEY = 'mining.fitStampByCostItemId.v1'

function readStore(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) out[key] = value.trim()
    }
    return out
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, string>): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Ignore quota / private mode failures.
  }
}

let memoryStore: Record<string, string> = {}

export function rememberCostItemFits(
  entries: Array<{ costItemId?: string | null; fitId?: string | null }>,
): void {
  let next = { ...readStore(), ...memoryStore }
  let changed = false
  for (const entry of entries) {
    const id = entry.costItemId?.trim()
    const fit = entry.fitId?.trim()
    if (!id || !fit) continue
    if (next[id] === fit) continue
    next = { ...next, [id]: fit }
    changed = true
  }
  if (!changed) return
  memoryStore = next
  writeStore(next)
}

export function lookupCostItemFit(costItemId: string | null | undefined): string | null {
  const id = costItemId?.trim()
  if (!id) return null
  if (!Object.keys(memoryStore).length) memoryStore = readStore()
  return memoryStore[id]?.trim() || null
}

export function applyStoredFitStampsToEstimation<
  T extends {
    blocks: Array<{
      entityTabs: Array<{
        steps: Array<{
          id: string
          functionInvestmentTypeId?: string | null
        }>
      }>
    }>
  },
>(estimation: T): T {
  if (!Object.keys(memoryStore).length) memoryStore = readStore()
  let changed = false
  const blocks = estimation.blocks.map((block) => ({
    ...block,
    entityTabs: block.entityTabs.map((tab) => ({
      ...tab,
      steps: tab.steps.map((step) => {
        const apiFit = step.functionInvestmentTypeId?.trim() || null
        if (apiFit) return step
        const stored = lookupCostItemFit(step.id)
        if (!stored) return step
        changed = true
        return { ...step, functionInvestmentTypeId: stored }
      }),
    })),
  }))
  return changed ? { ...estimation, blocks } : estimation
}
