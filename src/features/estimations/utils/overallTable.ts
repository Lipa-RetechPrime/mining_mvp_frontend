import type { OverallCostItemDto, OverallEntityDto, OverallListData } from '../api/investments/types'
import { compareEntityCodes } from '../constants/entityTabs'
import { parsePhaseTypeCode } from '../phases/phaseTypes'
import { resolvePhaseValue } from '../calculations/calculations'
import {
  computeExternalAgentPayable,
  computeFullAgentPayable,
  collectFilledPhaseCodes,
  contributorPhaseAmount,
  distributePaybackEqually,
  latestFilledPhaseAmong,
  nextPaybackPhaseCodes,
  paybackPhaseCodesFromStart,
} from '@/features/projects/partialContribution'

export type OverallRowKind =
  | 'section-header'
  | 'item'
  | 'subtotal'
  | 'design-charge'
  | 'section-total'
  | 'entity-total'

export type OverallTableRow = {
  kind: OverallRowKind
  slNo?: number
  details: string
  manpower?: number | null
  qrts?: number | null
  unitCost?: number | null
  amount?: number | null
  phaseValues: Record<string, number | null>
  /** Present on item rows when the source cost item id is known (entity table delete). */
  costItemId?: string | null
  /** Optional formula captions under phase values (e.g. Phase value × 20%). */
  phaseFormulas?: Record<string, string | null>
  /** Optional formula caption under the Amount cell. */
  amountFormula?: string | null
}

function sortPhaseColumns(columns: string[]): string[] {
  return [...columns].sort((a, b) => {
    const pa = parsePhaseTypeCode(a)
    const pb = parsePhaseTypeCode(b)
    if (!pa && !pb) return a.localeCompare(b)
    if (!pa) return 1
    if (!pb) return -1
    if (pa.prefix !== pb.prefix) return pa.prefix === 'C' ? -1 : 1
    return pa.index - pb.index
  })
}

function hasPhaseValue(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(Number(value)) && Number(value) !== 0
}

/**
 * Phase columns used in the overall sheet.
 * Only phases with at least one non-zero value are shown (empty/zero columns are omitted).
 */
export function collectOverallPhaseColumns(data: OverallListData): string[] {
  const seen = new Set<string>()

  for (const entity of data.entities ?? []) {
    for (const item of entity.costItems ?? []) {
      for (const [phase, value] of Object.entries(item.phases ?? {})) {
        if (phase && hasPhaseValue(value)) seen.add(phase)
      }
    }
    for (const phase of entity.phases ?? []) {
      if (phase.phase_name && hasPhaseValue(phase.total_value)) {
        seen.add(phase.phase_name)
      }
    }
  }

  for (const phase of data.overall_phase_totals ?? []) {
    if (phase.phase_name && hasPhaseValue(phase.total_value)) {
      seen.add(phase.phase_name)
    }
  }

  return sortPhaseColumns([...seen])
}

function sumItemPhases(
  items: OverallCostItemDto[],
  phaseColumns: string[],
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const column of phaseColumns) totals[column] = 0
  for (const item of items) {
    for (const column of phaseColumns) {
      totals[column] += item.phases?.[column] ?? 0
    }
  }
  return totals
}

function scalePhases(
  values: Record<string, number>,
  factor: number,
): Record<string, number> {
  const scaled: Record<string, number> = {}
  for (const [key, value] of Object.entries(values)) {
    scaled[key] = value * factor
  }
  return scaled
}

/** Design surcharge factor used for ownership Design rows: design% / 100. */
function designSurchargeFactor(designPercent: number | null | undefined): number {
  if (designPercent == null || !Number.isFinite(designPercent) || designPercent <= 0) {
    return 0
  }
  return designPercent / 100
}

/** Parse `@10%` from `Design, electrification etc @10%` rows. */
function parseDesignPercentLabel(details: string): number | null {
  const match = details.match(/@([\d.]+)\s*%/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

type PaybackOverlayEntry = {
  amount: number
  phaseValues: Record<string, number>
  details: string
}

function pushPaybackRow(
  nextRows: OverallTableRow[],
  nextColumns: string[],
  payback: PaybackOverlayEntry,
  phaseFormula?: string | null,
): void {
  const paybackPhaseValues: Record<string, number | null> = {}
  const phaseFormulas: Record<string, string | null> = {}
  for (const column of nextColumns) {
    const value = payback.phaseValues[column] ?? null
    paybackPhaseValues[column] = value
    if (
      phaseFormula &&
      value != null &&
      Number.isFinite(value) &&
      value !== 0
    ) {
      phaseFormulas[column] = phaseFormula
    }
  }
  nextRows.push({
    kind: 'design-charge',
    details: payback.details,
    amount: payback.amount,
    phaseValues: paybackPhaseValues,
    amountFormula: 'Escalated remainder',
    phaseFormulas:
      Object.keys(phaseFormulas).length > 0 ? phaseFormulas : undefined,
  })
}

/**
 * After payback rows are inserted / contribution scaling applied:
 * - Design[col] = (displayed Sub-Total[col] + payback[col]) × design%
 * - Sub-Total payback cols = sum(external payback)
 * - Total Amount payback cols = that Sub-Total × (1 + design%)
 */
function recomputeDesignRowFromDisplayedBases(
  rows: OverallTableRow[],
  columns: string[],
  paybackTargetCodes: Set<string>,
): OverallTableRow[] {
  const next = rows.map((row) => ({
    ...row,
    phaseValues: { ...row.phaseValues },
  }))

  let sectionStart = 0
  while (sectionStart < next.length) {
    if (next[sectionStart].kind !== 'section-header') {
      sectionStart += 1
      continue
    }

    let sectionEnd = sectionStart + 1
    while (
      sectionEnd < next.length &&
      next[sectionEnd].kind !== 'section-header' &&
      next[sectionEnd].kind !== 'entity-total'
    ) {
      sectionEnd += 1
    }

    let subtotalIndex = -1
    let designIndex = -1
    let totalIndex = -1
    const paybackSums: Record<string, number> = {}
    for (const column of columns) paybackSums[column] = 0

    for (let index = sectionStart; index < sectionEnd; index += 1) {
      const row = next[index]
      if (row.kind === 'subtotal') {
        subtotalIndex = index
      } else if (row.kind === 'section-total') {
        totalIndex = index
      } else if (
        row.kind === 'design-charge' &&
        row.details.startsWith('External agent payback')
      ) {
        for (const column of columns) {
          const value = row.phaseValues[column]
          if (value != null && Number.isFinite(value)) {
            paybackSums[column] += value
          }
        }
      } else if (
        row.kind === 'design-charge' &&
        row.details.includes('Design, electrification')
      ) {
        designIndex = index
      }
    }

    if (subtotalIndex >= 0 && paybackTargetCodes.size > 0) {
      const subtotalRow = next[subtotalIndex]
      for (const column of paybackTargetCodes) {
        subtotalRow.phaseValues[column] = paybackSums[column]
      }
    }

    if (designIndex >= 0 && subtotalIndex >= 0) {
      const designRow = next[designIndex]
      const subtotalRow = next[subtotalIndex]
      const factor = designSurchargeFactor(
        parseDesignPercentLabel(designRow.details),
      )
      for (const column of columns) {
        const subtotalValue = subtotalRow.phaseValues[column]
        const base =
          subtotalValue != null && Number.isFinite(subtotalValue)
            ? subtotalValue
            : 0
        designRow.phaseValues[column] = factor > 0 ? base * factor : null
      }

      if (totalIndex >= 0 && paybackTargetCodes.size > 0) {
        const totalRow = next[totalIndex]
        for (const column of paybackTargetCodes) {
          const subtotalValue = subtotalRow.phaseValues[column] ?? 0
          totalRow.phaseValues[column] =
            factor > 0 ? subtotalValue * (1 + factor) : subtotalValue
        }
      }
    }

    sectionStart = sectionEnd
  }

  return next
}

function toNullablePhases(
  values: Record<string, number>,
  phaseColumns: string[],
): Record<string, number | null> {
  const record: Record<string, number | null> = {}
  for (const column of phaseColumns) {
    record[column] = values[column] ?? 0
  }
  return record
}

function resolveEntityPercent(entity: OverallEntityDto): number | null {
  const candidates = [
    entity.percentage,
    (entity as { design_percentage?: number | null }).design_percentage,
  ]
  for (const value of candidates) {
    if (value != null && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function resolveDesignAmount(entity: OverallEntityDto): number | null {
  const candidates = [
    entity.design_percent,
    (entity as { design_10_percent?: number | null }).design_10_percent,
    (entity as { design_amount?: number | null }).design_amount,
  ]
  for (const value of candidates) {
    if (value != null && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function buildEntityRows(
  entity: OverallEntityDto,
  phaseColumns: string[],
  // isLastEntity: boolean,
  electrificationPercent: number,
): OverallTableRow[] {
  const rows: OverallTableRow[] = []
  const items = entity.costItems ?? []
  if (items.length === 0) return rows

  const factor = electrificationPercent / 100

  rows.push({
    kind: 'section-header',
    details: `FOR ${entity.entity_name.toUpperCase()}`,
    phaseValues: {},
  })

  items.forEach((item, index) => {
    const phaseValues: Record<string, number | null> = {}
    for (const column of phaseColumns) {
      phaseValues[column] =
        item.phases != null && Object.prototype.hasOwnProperty.call(item.phases, column)
          ? (item.phases[column] ?? 0)
          : null
    }
    rows.push({
      kind: 'item',
      slNo: index + 1,
      details: item.name || '',
      manpower: item.manpower,
      qrts: item.qrts,
      unitCost: item.unit_cost,
      amount: item.amount,
      phaseValues,
      costItemId: item.cost_item_id ?? null,
    })
  })

  const phaseSubtotals = sumItemPhases(items, phaseColumns)
  const phaseDesign = scalePhases(phaseSubtotals, factor)
  const phaseSectionTotal = scalePhases(phaseSubtotals, 1 + factor)

  // const subtotalLabel = isLastEntity ? 'Total' : 'Sub-total'
  // const sectionTotalLabel = isLastEntity ? 'Grand total' : 'Total Amount'
  const percentLabel = Number.isInteger(electrificationPercent)
    ? String(electrificationPercent)
    : electrificationPercent.toFixed(1)

  rows.push({
    kind: 'subtotal',
    details: 'Sub-Total',
    manpower: entity.total_manpower,
    qrts: entity.total_qrts,
    amount: entity.total_amount,
    phaseValues: toNullablePhases(phaseSubtotals, phaseColumns),
  })

  rows.push({
    kind: 'design-charge',
    details: `Design, electrification etc @${percentLabel}%`,
    amount: resolveDesignAmount(entity) ?? entity.total_amount * factor,
    phaseValues: toNullablePhases(phaseDesign, phaseColumns),
  })

  rows.push({
    kind: 'section-total',
    details: 'Total Amount',
    amount: entity.grand_total,
    phaseValues: toNullablePhases(phaseSectionTotal, phaseColumns),
  })

  return rows
}

export function buildOverallTableRows(data: OverallListData): {
  rows: OverallTableRow[]
  phaseColumns: string[]
  electrificationPercent: number | null
} {
  const phaseColumns = collectOverallPhaseColumns(data)
  const fromEntities = (data.entities ?? [])
    .map((entity) => resolveEntityPercent(entity))
    .find((value) => value != null)
  const electrificationPercent =
    data.electrification_percent != null && Number.isFinite(Number(data.electrification_percent))
      ? Number(data.electrification_percent)
      : (fromEntities ?? null)
  const entities = [...(data.entities ?? [])]
    .filter((entity) => (entity.costItems?.length ?? 0) > 0)
    .sort((a, b) => compareEntityCodes(a.entity_name, b.entity_name))
  const rows: OverallTableRow[] = []

  entities.forEach((entity) => {
    const entityPercent = resolveEntityPercent(entity) ?? electrificationPercent ?? 0
    rows.push(...buildEntityRows(entity, phaseColumns, entityPercent))
  })

  if (entities.length > 1) {
    const codes = entities.map((e) => e.entity_name.toUpperCase())
    const phaseTotals: Record<string, number> = {}
    for (const column of phaseColumns) {
      phaseTotals[column] =
        data.overall_phase_totals?.find((p) => p.phase_name === column)?.total_value ?? 0
    }

    rows.push({
      kind: 'entity-total',
      details: `TOTAL ${codes.join('+')}`,
      amount: data.overall_grand_total,
      phaseValues: toNullablePhases(phaseTotals, phaseColumns),
    })
  }

  return { rows, phaseColumns, electrificationPercent }
}

export type PartialPaybackOverlayInput = {
  contributionPercentage: number
  escalationPercent: number
  paybackPeriodYears: number
  /** Mine life-of-mine phase cap (does not change under outsourcing). */
  phaseLimit?: number | null
}

/**
 * Insert an equal-split external-agent payback row after each cost item.
 * Contributor phase cells show value × contribution% (not the raw entered amount).
 * Payback for every item in an entity starts after the top-most filled phase
 * among that entity’s cost items (shared window), then spans the next
 * `paybackPeriodYears` catalog phases capped by mine phaseLimit.
 * Example: item A ends P6, item B ends P2 → both payback from after P6.
 * Design% on phases is folded into the single Design/electrification row
 * as (displayed Sub-Total + payback) × design%.
 */
export function withPartialPaybackOverlay(
  built: ReturnType<typeof buildOverallTableRows>,
  settings: PartialPaybackOverlayInput,
): ReturnType<typeof buildOverallTableRows> {
  const { rows, phaseColumns, electrificationPercent } = built

  /** Per entity section: item row indexes sharing one payback start. */
  const itemIndexesBySection: number[][] = []
  let currentSectionItems: number[] = []
  rows.forEach((row, index) => {
    if (row.kind === 'section-header') {
      if (currentSectionItems.length > 0) {
        itemIndexesBySection.push(currentSectionItems)
      }
      currentSectionItems = []
      return
    }
    if (row.kind === 'item') currentSectionItems.push(index)
  })
  if (currentSectionItems.length > 0) {
    itemIndexesBySection.push(currentSectionItems)
  }

  /** Item row index → top-most filled contributor phase in that entity. */
  const sharedLastContributorByItem = new Map<number, string | null>()
  for (const itemIndexes of itemIndexesBySection) {
    const latest = latestFilledPhaseAmong(
      itemIndexes.map((index) => rows[index].phaseValues),
    )
    for (const index of itemIndexes) {
      sharedLastContributorByItem.set(index, latest)
    }
  }

  const allTargetCodes = new Set<string>()
  const paybackAfterItem = new Map<number, PaybackOverlayEntry>()

  rows.forEach((row, index) => {
    if (row.kind !== 'item') return

    const totalAmount =
      row.amount != null && Number.isFinite(row.amount) ? row.amount : 0
    let contributionA = 0
    for (const [, value] of Object.entries(row.phaseValues)) {
      if (value != null && Number.isFinite(value) && value !== 0) {
        contributionA +=
          contributorPhaseAmount(value, settings.contributionPercentage) ?? 0
      }
    }

    const { payableB } = computeExternalAgentPayable({
      totalAmount,
      contributionAmountA: contributionA,
      escalationPercent: settings.escalationPercent,
    })

    const sharedLast = sharedLastContributorByItem.get(index) ?? null
    const targets = nextPaybackPhaseCodes(
      sharedLast ? [sharedLast] : collectFilledPhaseCodes(row.phaseValues),
      settings.paybackPeriodYears,
      settings.phaseLimit,
    )
    if (targets.length === 0 || !(payableB > 0)) return

    for (const code of targets) allTargetCodes.add(code)
    paybackAfterItem.set(index, {
      amount: payableB,
      phaseValues: distributePaybackEqually(payableB, targets),
      details: row.details
        ? `External agent payback — ${row.details}`
        : 'External agent payback',
    })
  })

  const nextColumns = sortPhaseColumns([
    ...new Set([...phaseColumns, ...allTargetCodes]),
  ])

  const nextRows: OverallTableRow[] = []
  rows.forEach((row, index) => {
    const phaseValues: Record<string, number | null> = {}
    const phaseFormulas: Record<string, string | null> = {
      ...(row.phaseFormulas ?? {}),
    }
    for (const column of nextColumns) {
      const raw = row.phaseValues[column] ?? null
      if (rowKindShowsContributorShare(row.kind)) {
        phaseValues[column] =
          contributorPhaseAmount(raw, settings.contributionPercentage) ?? null
        if (
          row.kind === 'item' &&
          raw != null &&
          Number.isFinite(raw) &&
          raw !== 0
        ) {
          phaseFormulas[column] =
            `Phase value × ${settings.contributionPercentage}%`
        }
      } else {
        phaseValues[column] = raw
      }
    }
    nextRows.push({ ...row, phaseValues, phaseFormulas })

    const payback = paybackAfterItem.get(index)
    if (!payback) return
    const targetCount = Object.values(payback.phaseValues).filter(
      (v) => v != null && Number.isFinite(v) && v !== 0,
    ).length
    pushPaybackRow(
      nextRows,
      nextColumns,
      payback,
      targetCount > 0
        ? ``
        : 'Escalated remainder',
    )
  })

  return {
    rows: recomputeDesignRowFromDisplayedBases(
      nextRows,
      nextColumns,
      allTargetCodes,
    ),
    phaseColumns: nextColumns,
    electrificationPercent,
  }
}

/** Item / total rows show contributor share; design-charge & headers stay raw. */
function rowKindShowsContributorShare(kind: OverallRowKind): boolean {
  return (
    kind === 'item' ||
    kind === 'subtotal' ||
    kind === 'section-total' ||
    kind === 'entity-total'
  )
}

export type FullPaybackOverlayInput = {
  escalationPercent: number
  paybackPeriodYears: number
  paybackStartPhase: string
  phaseLimit?: number | null
}

/**
 * Insert equal-split external-agent payback row after each cost item (Full).
 * Payable b = total × (1 + escalation%); distributed from the chosen start phase.
 * Design% on phases is folded into the single Design/electrification row
 * as (displayed Sub-Total + payback) × design%.
 */
export function withFullPaybackOverlay(
  built: ReturnType<typeof buildOverallTableRows>,
  settings: FullPaybackOverlayInput,
): ReturnType<typeof buildOverallTableRows> {
  const { rows, phaseColumns, electrificationPercent } = built

  const allTargetCodes = new Set<string>()
  const paybackAfterItem = new Map<number, PaybackOverlayEntry>()

  rows.forEach((row, index) => {
    if (row.kind !== 'item') return

    const totalAmount =
      row.amount != null && Number.isFinite(row.amount) ? row.amount : 0
    const payableB = computeFullAgentPayable({
      totalAmount,
      escalationPercent: settings.escalationPercent,
    })

    const targets = paybackPhaseCodesFromStart(
      settings.paybackStartPhase,
      settings.paybackPeriodYears,
      settings.phaseLimit,
    )
    if (targets.length === 0 || !(payableB > 0)) return

    for (const code of targets) allTargetCodes.add(code)
    paybackAfterItem.set(index, {
      amount: payableB,
      phaseValues: distributePaybackEqually(payableB, targets),
      details: row.details
        ? `External agent payback — ${row.details}`
        : 'External agent payback',
    })
  })

  const nextColumns = sortPhaseColumns([
    ...new Set([...phaseColumns, ...allTargetCodes]),
  ])

  const nextRows: OverallTableRow[] = []
  rows.forEach((row, index) => {
    const phaseValues: Record<string, number | null> = {}
    for (const column of nextColumns) {
      phaseValues[column] = row.phaseValues[column] ?? null
    }
    nextRows.push({ ...row, phaseValues })

    const payback = paybackAfterItem.get(index)
    if (!payback) return
    const targetCount = Object.keys(payback.phaseValues).length
    pushPaybackRow(
      nextRows,
      nextColumns,
      payback,
      targetCount > 0
        ? `Escalated Remainder ÷ ${targetCount}`
        : ``,
    )
  })

  return {
    rows: recomputeDesignRowFromDisplayedBases(
      nextRows,
      nextColumns,
      allTargetCodes,
    ),
    phaseColumns: nextColumns,
    electrificationPercent,
  }
}

/**
 * Build Overall-sheet shaped data for a single entity tab so ECL/MDO tables
 * use the same Sub-Total / Design / Total Amount layout as Overall.
 */
export function buildEntityOverallListData(params: {
  steps: Array<{
    id: string
    details: string
    manpower: number | null
    qrts: number | null
    unitCost: number | null
    amount: number | null
    phases: Array<{
      phaseType: string
      calculationMode: 'manual' | 'automatic'
      value: number | null
      percentage: number | null
    }>
  }>
  entityCode: string
  entityId: string
  electrificationPercent: number | null
  functionName: string
  mineId: string
  mineName: string
}): OverallListData {
  const costItems: OverallCostItemDto[] = params.steps.map((step) => {
    const amount = step.amount ?? 0
    const phases: Record<string, number> = {}
    for (const phase of step.phases) {
      if (!phase.phaseType) continue
      phases[phase.phaseType] = resolvePhaseValue(phase, amount)
    }
    return {
      name: step.details?.trim() || 'Untitled Cost Item',
      manpower: step.manpower ?? 0,
      qrts: step.qrts ?? 0,
      unit_cost: step.unitCost ?? 0,
      amount,
      phases,
      cost_item_id: step.id,
    }
  })

  const total_manpower = costItems.reduce((sum, item) => sum + (item.manpower ?? 0), 0)
  const total_qrts = costItems.reduce((sum, item) => sum + (item.qrts ?? 0), 0)
  const total_amount = costItems.reduce((sum, item) => sum + (item.amount ?? 0), 0)
  const pct =
    params.electrificationPercent != null &&
    Number.isFinite(params.electrificationPercent) &&
    params.electrificationPercent >= 0
      ? params.electrificationPercent
      : 0
  const design_amount = total_amount * (pct / 100)
  const grand_total = total_amount + design_amount

  const draftForColumns: OverallListData = {
    mine_id: params.mineId,
    mine_name: params.mineName,
    function_name: params.functionName,
    entities: [
      {
        entity_name: params.entityCode,
        total_manpower,
        total_qrts,
        total_amount,
        grand_total,
        costItems,
        phases: [],
      },
    ],
    overall_grand_total: grand_total,
    overall_phase_totals: [],
  }
  const phaseColumns = collectOverallPhaseColumns(draftForColumns)
  const phaseTotals = sumItemPhases(costItems, phaseColumns)
  const entityPhases = phaseColumns.map((phase_name) => ({
    phase_name,
    total_value: phaseTotals[phase_name] ?? 0,
  }))

  return {
    mine_id: params.mineId,
    mine_name: params.mineName,
    function_name: params.functionName,
    electrification_percent: params.electrificationPercent,
    entities: [
      {
        entity_id: params.entityId,
        entity_name: params.entityCode,
        total_manpower,
        total_qrts,
        total_amount,
        design_percent: design_amount,
        design_amount,
        grand_total,
        percentage: params.electrificationPercent,
        phases: entityPhases,
        costItems,
      },
    ],
    overall_grand_total: grand_total,
    overall_phase_totals: entityPhases,
  }
}
