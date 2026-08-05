/** Newest `updatedAt` first; missing dates sort last. Tie-break by name. */
export function sortMinesByLastUpdated<
  T extends {
    updatedAt?: string
    mine_name?: string
    siteSubtitle?: string
  },
>(mines: T[]): T[] {
  return [...mines].sort((a, b) => {
    const aTime = a.updatedAt ? Date.parse(a.updatedAt) : Number.NaN
    const bTime = b.updatedAt ? Date.parse(b.updatedAt) : Number.NaN
    const aValid = Number.isFinite(aTime)
    const bValid = Number.isFinite(bTime)
    if (aValid && bValid && aTime !== bTime) return bTime - aTime
    if (aValid && !bValid) return -1
    if (!aValid && bValid) return 1
    const aName = a.mine_name || a.siteSubtitle || ''
    const bName = b.mine_name || b.siteSubtitle || ''
    return aName.localeCompare(bName)
  })
}

/** Display last-updated date for mine cards / dropdowns. */
export function formatLastUpdated(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
