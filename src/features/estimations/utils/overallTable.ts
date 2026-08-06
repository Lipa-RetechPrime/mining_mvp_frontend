import type { OverallCostItemDto, OverallEntityDto, OverallListData } from '../api/investments/types'
import { compareEntityCodes } from '../constants/entityTabs'
import { parsePhaseTypeCode } from '../phases/phaseTypes'
import {
  computeExternalAgentPayable,
  computeFullAgentPayable,
  distributePaybackEqually,
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
 * Does not mutate ownership phase values from the API.
 */
export function withPartialPaybackOverlay(
  built: ReturnType<typeof buildOverallTableRows>,
  settings: PartialPaybackOverlayInput,
): ReturnType<typeof buildOverallTableRows> {
  const { rows, phaseColumns, electrificationPercent } = built

  const allTargetCodes = new Set<string>()
  const paybackAfterItem = new Map<
    number,
    { amount: number; phaseValues: Record<string, number>; details: string }
  >()

  rows.forEach((row, index) => {
    if (row.kind !== 'item') return

    const totalAmount =
      row.amount != null && Number.isFinite(row.amount) ? row.amount : 0
    let contributionA = 0
    const filledCodes: string[] = []
    for (const [code, value] of Object.entries(row.phaseValues)) {
      if (value != null && Number.isFinite(value) && value !== 0) {
        filledCodes.push(code)
        contributionA += (value * settings.contributionPercentage) / 100
      }
    }

    const { payableB } = computeExternalAgentPayable({
      totalAmount,
      contributionAmountA: contributionA,
      escalationPercent: settings.escalationPercent,
    })

    const targets = nextPaybackPhaseCodes(
      filledCodes,
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

    const paybackPhaseValues: Record<string, number | null> = {}
    for (const column of nextColumns) {
      paybackPhaseValues[column] = payback.phaseValues[column] ?? null
    }
    nextRows.push({
      kind: 'design-charge',
      details: payback.details,
      amount: payback.amount,
      phaseValues: paybackPhaseValues,
    })
  })

  return {
    rows: nextRows,
    phaseColumns: nextColumns,
    electrificationPercent,
  }
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
 */
export function withFullPaybackOverlay(
  built: ReturnType<typeof buildOverallTableRows>,
  settings: FullPaybackOverlayInput,
): ReturnType<typeof buildOverallTableRows> {
  const { rows, phaseColumns, electrificationPercent } = built

  const allTargetCodes = new Set<string>()
  const paybackAfterItem = new Map<
    number,
    { amount: number; phaseValues: Record<string, number>; details: string }
  >()

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

    const paybackPhaseValues: Record<string, number | null> = {}
    for (const column of nextColumns) {
      paybackPhaseValues[column] = payback.phaseValues[column] ?? null
    }
    nextRows.push({
      kind: 'design-charge',
      details: payback.details,
      amount: payback.amount,
      phaseValues: paybackPhaseValues,
    })
  })

  return {
    rows: nextRows,
    phaseColumns: nextColumns,
    electrificationPercent,
  }
}
