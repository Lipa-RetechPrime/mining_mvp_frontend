import type { Phase, PhaseTypeCode, PhaseTypeMaster } from '../types/estimation'

/** Construction (C) phase codes currently enabled in the catalog. */
export const CONSTRUCTION_PHASE_TYPES_COUNT = 2
/** Production (P) phase codes in the catalog. */
export const PRODUCTION_PHASE_TYPES_COUNT = 20
/** @deprecated Use CONSTRUCTION_PHASE_TYPES_COUNT / PRODUCTION_PHASE_TYPES_COUNT. */
export const PHASE_TYPES_PER_SERIES = PRODUCTION_PHASE_TYPES_COUNT
export const PHASE_TYPE_COUNT =
  CONSTRUCTION_PHASE_TYPES_COUNT + PRODUCTION_PHASE_TYPES_COUNT

/** Default phases created after the user sets the phase limit. */
export const DEFAULT_INITIAL_PHASE_TYPES: PhaseTypeCode[] = [
  'C1',
  'C2',
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
  'P6',
]
export const DEFAULT_INITIAL_PHASE_COUNT = DEFAULT_INITIAL_PHASE_TYPES.length
/** How many phase rows the "Add phase" button creates per click. */
export const PHASE_ADD_BATCH_SIZE = 8

export interface PhaseTypeCatalogOptions {
  constructionCount?: number
  productionCount?: number
}

export function buildPhaseTypeCatalog(
  options: PhaseTypeCatalogOptions = {},
): PhaseTypeMaster[] {
  const constructionCount =
    options.constructionCount ?? CONSTRUCTION_PHASE_TYPES_COUNT
  const productionCount = options.productionCount ?? PRODUCTION_PHASE_TYPES_COUNT
  const catalog: PhaseTypeMaster[] = []
  for (let i = 1; i <= constructionCount; i += 1) {
    const code = `C${i}`
    catalog.push({ code, label: code })
  }
  for (let i = 1; i <= productionCount; i += 1) {
    const code = `P${i}`
    catalog.push({ code, label: code })
  }
  return catalog
}

export const FALLBACK_PHASE_TYPES: PhaseTypeMaster[] = buildPhaseTypeCatalog()

/**
 * Hardcoded phase type for a zero-based index in the sequence:
 * C1, C2, P1, P2, … Pn
 */
export function phaseTypeAtIndex(index: number): PhaseTypeCode {
  if (index === 0) return 'C1'
  if (index === 1) return 'C2'
  return `P${index - 1}`
}

/** Zero-based catalog index for a phase code (C1→0, C2→1, P1→2, …). */
export function phaseTypeIndex(code: string): number | null {
  const trimmed = normalizeCatalogPhaseCode(code)
  if (!trimmed) return null
  if (trimmed === 'C1') return 0
  if (trimmed === 'C2') return 1
  const match = trimmed.match(/^P(\d+)$/)
  if (!match) return null
  return Number(match[1]) + 1
}

/**
 * Map Nest/API phase labels or UUIDs-as-names to catalog codes (C1, P1, …).
 * Accepts "P1", "p1", "Phase P1", etc. Returns null when no catalog code is found.
 */
export function normalizeCatalogPhaseCode(
  raw: string | null | undefined,
): PhaseTypeCode | null {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  if (/^[CP]\d+$/i.test(trimmed)) {
    return trimmed.toUpperCase() as PhaseTypeCode
  }
  const embedded = trimmed.match(/\b([CP]\d+)\b/i)
  if (embedded) return embedded[1].toUpperCase() as PhaseTypeCode
  return null
}

/**
 * Next catalog index to append after existing typed phases.
 * Uses the highest existing type so gaps/reloads do not recreate duplicates.
 */
export function nextPhaseStartIndex(
  existingPhases: Array<{ phaseType: string }>,
): number {
  let maxIndex = -1
  for (const phase of existingPhases) {
    const index = phaseTypeIndex(phase.phaseType)
    if (index != null) maxIndex = Math.max(maxIndex, index)
  }
  return maxIndex + 1
}

export function createTypedPhases(
  startIndex: number,
  count: number,
  createPhase: (phaseType: PhaseTypeCode) => Phase,
): Phase[] {
  return Array.from({ length: count }, (_, offset) =>
    createPhase(phaseTypeAtIndex(startIndex + offset)),
  )
}

/** Append the next batch of typed phases, skipping any type already present. */
export function appendTypedPhaseBatch(
  existingPhases: Phase[],
  count: number,
  createPhase: (phaseType: PhaseTypeCode) => Phase,
): Phase[] {
  if (count <= 0) return existingPhases
  const used = new Set(
    existingPhases.map((phase) => phase.phaseType).filter(Boolean),
  )
  const startIndex = nextPhaseStartIndex(existingPhases)
  const created: Phase[] = []
  let offset = 0
  while (created.length < count) {
    const phaseType = phaseTypeAtIndex(startIndex + offset)
    offset += 1
    if (used.has(phaseType)) continue
    used.add(phaseType)
    created.push(createPhase(phaseType))
    // Safety: avoid infinite loop if catalog is exhausted.
    if (offset > PHASE_TYPE_COUNT + count) break
  }
  return [...existingPhases, ...created]
}

type ParsedPhaseCode = { prefix: 'C' | 'P'; index: number }

export function parsePhaseTypeCode(code: string): ParsedPhaseCode | null {
  const match = code.match(/^([CP])(\d+)$/)
  if (!match) return null
  return { prefix: match[1] as 'C' | 'P', index: Number(match[2]) }
}

/** Canonical order: C1, C2, P1, P2, … (unknown codes last). */
export function comparePhaseTypeCodes(a: string, b: string): number {
  const pa = parsePhaseTypeCode(a)
  const pb = parsePhaseTypeCode(b)
  if (!pa && !pb) return a.localeCompare(b)
  if (!pa) return 1
  if (!pb) return -1
  if (pa.prefix !== pb.prefix) return pa.prefix === 'C' ? -1 : 1
  return pa.index - pb.index
}

/** Stable phase sequence for display / API round-trips. */
export function sortPhasesByCanonicalOrder<T>(
  phases: T[],
  getCode: (phase: T) => string,
): T[] {
  return [...phases].sort((left, right) =>
    comparePhaseTypeCodes(getCode(left) || '', getCode(right) || ''),
  )
}

export interface PhaseTypeOption extends PhaseTypeMaster {
  disabled: boolean
}

function minSelectableIndexByPrefix(
  previousTypes: Array<PhaseTypeCode | ''>,
  current: PhaseTypeCode | '',
): Partial<Record<'C' | 'P', number>> {
  const minIndexByPrefix: Partial<Record<'C' | 'P', number>> = {}

  for (const code of previousTypes) {
    if (!code) continue
    const parsed = parsePhaseTypeCode(code)
    if (!parsed) continue
    minIndexByPrefix[parsed.prefix] = Math.max(
      minIndexByPrefix[parsed.prefix] ?? 0,
      parsed.index,
    )
  }

  const currentParsed = current ? parsePhaseTypeCode(current) : null
  if (currentParsed) {
    minIndexByPrefix[currentParsed.prefix] = Math.max(
      minIndexByPrefix[currentParsed.prefix] ?? 0,
      currentParsed.index,
    )
  }

  return minIndexByPrefix
}

export function availablePhaseTypes(
  allTypes: PhaseTypeMaster[],
  usedTypes: Array<PhaseTypeCode | ''>,
  current: PhaseTypeCode | '',
  previousTypes: Array<PhaseTypeCode | ''> = [],
): PhaseTypeOption[] {
  const minIndexByPrefix = minSelectableIndexByPrefix(previousTypes, current)

  return allTypes.map((t) => {
    const parsed = parsePhaseTypeCode(t.code)
    const minIndex = parsed ? minIndexByPrefix[parsed.prefix] : undefined
    const disabled =
      t.code !== current &&
      (usedTypes.includes(t.code) ||
        (parsed !== null &&
          minIndex !== undefined &&
          minIndex > 0 &&
          parsed.index < minIndex))

    return { ...t, disabled }
  })
}

export function canAddPhase(
  phasesCount: number,
  phaseLimit: number | null | undefined,
): boolean {
  if (phaseLimit == null || phaseLimit <= 0) return false
  return phasesCount < phaseLimit
}

/** How many phases the next Add click may create (0 when at/over limit). */
export function nextPhaseBatchCount(
  phasesCount: number,
  phaseLimit: number | null | undefined,
  batchSize: number = PHASE_ADD_BATCH_SIZE,
): number {
  if (phaseLimit == null || phaseLimit <= 0) return 0
  const remaining = Math.floor(phaseLimit) - phasesCount
  if (remaining <= 0) return 0
  return Math.min(batchSize, remaining)
}

/** Drop trailing phases so length never exceeds the mine max. */
export function clampPhasesToLimit<T>(phases: T[], phaseLimit: number | null | undefined): T[] {
  if (phaseLimit == null || phaseLimit <= 0) return phases
  const limit = Math.floor(phaseLimit)
  if (phases.length <= limit) return phases
  return phases.slice(0, limit)
}

/** First unused phase type in catalog order (defaults to C1). */
export function nextAvailablePhaseType(
  allTypes: PhaseTypeMaster[] = FALLBACK_PHASE_TYPES,
  usedTypes: Array<PhaseTypeCode | ''> = [],
): PhaseTypeCode {
  const catalog = allTypes.length > 0 ? allTypes : FALLBACK_PHASE_TYPES
  const next = catalog.find((t) => !usedTypes.includes(t.code))
  return next?.code ?? catalog[0]?.code ?? 'C1'
}
