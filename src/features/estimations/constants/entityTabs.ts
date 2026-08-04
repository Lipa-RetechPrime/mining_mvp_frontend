/** Virtual first tab — conjugated view of all entity tabs. */
export const OVERALL_TAB_ID = 'overall'
export const OVERALL_TAB_CODE = 'Overall'

/**
 * Stable display / create order for entity tabs.
 * API list order follows cost-item insertion and must not drive the UI.
 */
export const CANONICAL_ENTITY_CODES = ['ECL', 'MDO'] as const

export function entityCodeSortKey(code: string): number {
  const normalized = code.trim().toUpperCase()
  const index = CANONICAL_ENTITY_CODES.indexOf(
    normalized as (typeof CANONICAL_ENTITY_CODES)[number],
  )
  return index === -1 ? CANONICAL_ENTITY_CODES.length : index
}

export function compareEntityCodes(a: string, b: string): number {
  const byCanon = entityCodeSortKey(a) - entityCodeSortKey(b)
  if (byCanon !== 0) return byCanon
  return a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'base' })
}
