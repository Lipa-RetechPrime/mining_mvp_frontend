import { createEmptyPhase, createId } from '../../utils/factories'
import { computeAmount } from '../../calculations/calculations'
import {
  DEFAULT_INITIAL_PHASE_COUNT,
  phaseTypeAtIndex,
  phaseTypeIndex,
  sortPhasesByCanonicalOrder,
} from '../../phases/phaseTypes'
import { compareEntityCodes } from '../../constants/entityTabs'
import { getEntities } from '../master'
import { generateUuid } from '../../utils/uuid'
import {
  applyMinePhaseLimitToBlocks,
  cleanUuid,
  isStepPopulated,
  isUuid,
} from './domain'
import type {
  InvestmentCostItemDto,
  InvestmentDto,
  InvestmentPhasingDto,
  MapMode,
} from './types'
import type {
  AmountMode,
  CalculationMode,
  EntityMaster,
  EntityTabState,
  Estimation,
  Phase,
  Step,
} from '../../types/estimation'

function entityIdFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

/** Preserve explicit zero; only fall back when the field was left empty. */
function dtoNumber(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  return value
}

/** Drop nameless placeholder phases and duplicate phase types. */
function uniqueTypedPhases(phases: Phase[]): Phase[] {
  const seen = new Set<string>()
  const unique: Phase[] = []
  for (const phase of phases) {
    const type = phase.phaseType?.trim()
    if (!type || seen.has(type)) continue
    seen.add(type)
    unique.push({ ...phase, phaseType: type })
  }
  return unique
}

/**
 * Ensure contiguous typed slots from C1 through the highest phase present.
 * Trailing empties are preserved when they were saved as typed rows.
 */
function withEmptyPhaseSlots(phases: Phase[]): Phase[] {
  const typed = uniqueTypedPhases(phases)
  if (typed.length === 0) return []

  let maxIndex = -1
  const byType = new Map<string, Phase>()
  for (const phase of typed) {
    byType.set(phase.phaseType, phase)
    const index = phaseTypeIndex(phase.phaseType)
    if (index != null) maxIndex = Math.max(maxIndex, index)
  }
  if (maxIndex < 0) return typed

  const result: Phase[] = []
  for (let i = 0; i <= maxIndex; i += 1) {
    const type = phaseTypeAtIndex(i)
    result.push(byType.get(type) ?? createEmptyPhase(type))
  }
  return result
}

function percentageFromValue(value: number | null, amount: number): number | null {
  if (value == null || Number.isNaN(value) || !(amount > 0) || value === 0) return null
  return Math.round((value / amount) * 1e6) / 1e4
}

function mapPhasingToPhase(phasing: InvestmentPhasingDto, amount: number): Phase {
  const calculationMode: CalculationMode =
    phasing.calculation_mode === 'calculated' ? 'automatic' : 'manual'
  let value =
    phasing.value == null || Number.isNaN(Number(phasing.value))
      ? null
      : Number(phasing.value)
  // API previously stored empty slots as 0; keep those fields null in the UI.
  // Explicit user-entered 0 is uncommon for phase amounts; prefer empty over 0.00.
  if (calculationMode === 'manual' && value === 0) value = null
  const percentage =
    calculationMode === 'automatic'
      ? phasing.percentage !== undefined && phasing.percentage !== null
        ? phasing.percentage
        : percentageFromValue(value, amount)
      : null
  // Same for calculated mode: a stored 0% is treated as unset.
  const normalizedPercentage =
    percentage === 0 ? null : percentage
  return {
    id: createId('ph'),
    phaseType: phasing.phase_name || '',
    calculationMode,
    value:
      calculationMode === 'automatic' && normalizedPercentage == null
        ? null
        : value,
    percentage: calculationMode === 'automatic' ? normalizedPercentage : null,
  }
}

/** Backfill missing automatic % from stored value (e.g. older API payloads). */
export function withDerivedAutomaticPercentages(estimation: Estimation): Estimation {
  return {
    ...estimation,
    blocks: estimation.blocks.map((block) => ({
      ...block,
      entityTabs: block.entityTabs.map((tab) => ({
        ...tab,
        steps: tab.steps.map((step) => ({
          ...step,
          phases: step.phases.map((phase) => {
            if (
              phase.calculationMode !== 'automatic' ||
              phase.percentage != null ||
              phase.value == null
            ) {
              return phase
            }
            return {
              ...phase,
              percentage: percentageFromValue(phase.value, step.amount ?? 0),
            }
          }),
        })),
      })),
    })),
  }
}

function resolveAmountMode(
  raw: string | undefined,
  amount: number | null,
  calculatedAmount: number,
): AmountMode {
  const mode = (raw ?? '').trim().toLowerCase()
  if (mode === 'manual') return 'manual'
  if (mode === 'calculated' || mode === 'automatic') return 'calculated'
  return amount != null && amount === calculatedAmount ? 'calculated' : 'manual'
}

function resolveUnitCostMode(
  raw: string | undefined,
  unitCost: number | null,
): import('../../types/estimation').UnitCostMode {
  const mode = (raw ?? '').trim().toLowerCase()
  if (mode === 'on_hire' || mode === 'on-hire' || mode === 'onhire') return 'on_hire'
  if (mode === 'manual') return 'manual'
  // Legacy rows: treat an explicit zero with no mode as manual (user may have entered 0).
  void unitCost
  return 'manual'
}

function mapCostItemToStep(costItem: InvestmentCostItemDto): Step {
  const byName = new Map(
    (costItem.inputs ?? []).map((input) => [input.node_name.trim().toLowerCase(), input]),
  )
  const input1 =
    byName.get('manpower') ?? byName.get('label 1') ?? costItem.inputs?.[0]
  const input2 = byName.get('qrts') ?? byName.get('label 2') ?? costItem.inputs?.[1]
  const input3 =
    byName.get('unit cost') ?? byName.get('label 3') ?? costItem.inputs?.[2]
  const amount =
    costItem.amount_value != null && Number.isFinite(Number(costItem.amount_value))
      ? Number(costItem.amount_value)
      : null
  const unitCostMode = resolveUnitCostMode(
    (costItem as { unit_cost_mode?: string; unitCostMode?: string }).unit_cost_mode ??
      (costItem as { unitCostMode?: string }).unitCostMode,
    input3?.value ?? null,
  )
  const unitCost =
    unitCostMode === 'on_hire' ? 0 : (input3?.value ?? null)
  const calculatedAmount = computeAmount(input2?.value ?? null, unitCost)
  const phases = withEmptyPhaseSlots(
    sortPhasesByCanonicalOrder(
      costItem.phasing
        .filter((phasing) => Boolean(phasing.phase_name?.trim()))
        .map((phasing) => mapPhasingToPhase(phasing, amount ?? 0)),
      (phase) => phase.phaseType || '',
    ),
  )
  const amountMode = resolveAmountMode(
    costItem.amount_mode ?? (costItem as { amountMode?: string }).amountMode,
    amount,
    calculatedAmount,
  )
  return {
    id: costItem.cost_item_id || createId('step'),
    details: costItem.name || '',
    fieldLabels: {
      label1: input1?.node_name || 'Label 1',
      label2: input2?.node_name || 'Label 2',
      label3: input3?.node_name || 'Label 3',
    },
    manpower: input1?.value ?? null,
    qrts: input2?.value ?? null,
    unitCost,
    amount,
    amountMode,
    unitCostMode,
    phases,
    // Prefer mine limit when known; otherwise keep at least current phase count for edit UX.
    phaseLimit: Math.max(phases.length, DEFAULT_INITIAL_PHASE_COUNT),
    phasePageIndex: 0,
  }
}

function resolveMinePhaseLimit(dto: InvestmentDto): number | null {
  const raw = dto.phase_limit
  if (raw == null) return null
  const parsed = Math.floor(Number(raw))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

/** When list omits phase_limit, infer from saved phase rows / step limits. */
function inferPhaseLimitFromSteps(blocks: Estimation['blocks']): number | null {
  let max = 0
  for (const block of blocks) {
    for (const tab of block.entityTabs) {
      for (const step of tab.steps) {
        if (step.phaseLimit != null && step.phaseLimit > max) max = step.phaseLimit
        if (step.phases.length > max) max = step.phases.length
      }
    }
  }
  return max > 0 ? max : null
}

export function mapEstimationToDto(estimation: Estimation, mode: MapMode = 'update') {
  if (mode === 'update' && !estimation.mine_id) {
    throw new Error('Estimation is missing mine_id')
  }
  const mine_name = estimation.siteSubtitle?.trim() || 'Chuperbhita Simlong OCP'

  const block = estimation.blocks[0]
  const function_name = block?.sectorName?.trim() || 'Residential buildings'
  const function_master_id =
    block && isUuid(block.id) ? cleanUuid(block.id) : generateUuid()

  const orderedTabs = [...(block?.entityTabs || [])].sort((a, b) =>
    compareEntityCodes(a.entityCode, b.entityCode),
  )

  const entities = orderedTabs.map((tab) => {
    const entityId = isUuid(tab.entityId) ? cleanUuid(tab.entityId) : undefined
    return {
      entity_name: tab.entityCode,
      ...(entityId ? { entity_id: entityId } : {}),
      costItems: tab.steps.filter(isStepPopulated).map((step) => {
        const unitCostValue =
          step.unitCostMode === 'on_hire' ? 0 : dtoNumber(step.unitCost)
        const base = {
          name: step.details?.trim() || 'Untitled Cost Item',
          inputs: [
            { node_name: 'Manpower', value: dtoNumber(step.manpower) },
            { node_name: 'Qrts', value: dtoNumber(step.qrts) },
            { node_name: 'Unit Cost', value: unitCostValue },
          ],
          amount_value: dtoNumber(step.amount),
          amount_mode: step.amountMode === 'manual' ? 'manual' : 'calculated',
          phasing: sortPhasesByCanonicalOrder(
            // Persist every typed phase slot that was added (including empty
            // trailing ones) so edit mode never loses rows. No nameless "-".
            // API requires a number — empty values are stored as 0 and mapped
            // back to null in the UI on load.
            uniqueTypedPhases(step.phases),
            (phase) => phase.phaseType || '',
          ).map((phase) => {
            const calculation_mode =
              phase.calculationMode === 'automatic' ? 'calculated' : 'manual'
            if (calculation_mode === 'manual') {
              return {
                phase_name: phase.phaseType,
                value: dtoNumber(phase.value),
                calculation_mode,
              }
            }
            const hasPercentage =
              phase.percentage != null && !Number.isNaN(phase.percentage)
            return {
              phase_name: phase.phaseType,
              value: hasPercentage ? dtoNumber(phase.value) : 0,
              calculation_mode,
              percentage: hasPercentage ? Number(phase.percentage) : 0,
            }
          }),
        }
        return mode === 'update' ? { id: cleanUuid(step.id), ...base } : base
      }),
    }
  })

  if (mode === 'create') {
    return {
      mine_name,
      function_master_id,
      function_name,
      entities,
    }
  }

  return {
    mine_id: estimation.mine_id,
    mine_name,
    function_master_id,
    function_name,
    entities,
  }
}

/** Reverse of {@link mapEstimationToDto}: backend investment row → frontend Estimation. */
export function mapDtoToEstimation(dto: InvestmentDto): Estimation {
  const orderedEntities = [...dto.entities].sort((a, b) =>
    compareEntityCodes(a.entity_name, b.entity_name),
  )
  const entityTabs = orderedEntities.map((entity) => {
    const steps = entity.costItems.map(mapCostItemToStep)
    return {
      entityId: entity.entity_id || entityIdFromName(entity.entity_name),
      entityCode: entity.entity_name,
      steps,
      currentStepIndex: Math.max(0, steps.length - 1),
    }
  })

  const blocks = [
    {
      id: dto.function_master_id || generateUuid(),
      sectorId: entityIdFromName(dto.function_name || 'Residential buildings'),
      sectorName: dto.function_name?.trim() || 'Residential buildings',
      activeEntityId: entityTabs[0]?.entityId ?? '',
      entityTabs,
    },
  ]

  const phaseLimitFromApi = resolveMinePhaseLimit(dto)
  const phaseLimit = phaseLimitFromApi ?? inferPhaseLimitFromSteps(blocks)

  const percentageMasterIdByEntity: Record<string, string> = {}
  const electrificationPercentByEntity: Record<string, number> = {}
  for (const entity of orderedEntities) {
    const entityId = entity.entity_id || entityIdFromName(entity.entity_name)
    if (entity.percentage_master_id) {
      percentageMasterIdByEntity[entityId] = entity.percentage_master_id
    }
    if (entity.percentage != null && Number.isFinite(Number(entity.percentage))) {
      electrificationPercentByEntity[entityId] = Number(entity.percentage)
    }
  }

  return {
    id: dto.mine_id,
    mine_id: dto.mine_id,
    siteSubtitle: dto.mine_name || 'Chuperbhita Simlong OCP',
    appendixLabel: dto.appendix_label || 'APPENDIX A 2.2',
    phaseLimit,
    electrificationPercentByEntity,
    percentageMasterIdByEntity,
    blocks: applyMinePhaseLimitToBlocks(blocks, phaseLimit),
    createdAt: dto.created_at ?? undefined,
    updatedAt: dto.updated_at ?? undefined,
  }
}

/**
 * API omits entities with zero cost items. Re-attach every master entity tab
 * (empty steps) so empty-tab UX survives list refresh / page reload.
 */
export function ensureEntityTabs(
  estimation: Estimation,
  masters: EntityMaster[],
): Estimation {
  if (masters.length === 0) {
    return {
      ...estimation,
      blocks: estimation.blocks.map((block) => ({
        ...block,
        entityTabs: [...block.entityTabs].sort((a, b) =>
          compareEntityCodes(a.entityCode, b.entityCode),
        ),
      })),
    }
  }

  const orderedMasters = [...masters].sort((a, b) => compareEntityCodes(a.code, b.code))
  let electrificationPercentByEntity = {
    ...(estimation.electrificationPercentByEntity ?? {}),
  }
  let percentageMasterIdByEntity = {
    ...(estimation.percentageMasterIdByEntity ?? {}),
  }

  function remappingEntityKey(fromId: string, toId: string) {
    if (!fromId || !toId || fromId === toId) return
    if (
      electrificationPercentByEntity[fromId] != null &&
      electrificationPercentByEntity[toId] == null
    ) {
      electrificationPercentByEntity = {
        ...electrificationPercentByEntity,
        [toId]: electrificationPercentByEntity[fromId],
      }
      delete electrificationPercentByEntity[fromId]
    }
    if (
      percentageMasterIdByEntity[fromId] &&
      !percentageMasterIdByEntity[toId]
    ) {
      percentageMasterIdByEntity = {
        ...percentageMasterIdByEntity,
        [toId]: percentageMasterIdByEntity[fromId],
      }
      delete percentageMasterIdByEntity[fromId]
    }
  }

  const blocks = estimation.blocks.map((block) => {
    const byId = new Map(block.entityTabs.map((tab) => [tab.entityId, tab]))
    const byCode = new Map(
      block.entityTabs.map((tab) => [tab.entityCode.trim().toLowerCase(), tab]),
    )

    const entityTabs: EntityTabState[] = orderedMasters.map((master) => {
      const existing =
        byId.get(master.id) ?? byCode.get(master.code.trim().toLowerCase())
      if (existing) {
        const entityId = isUuid(existing.entityId) ? existing.entityId : master.id
        remappingEntityKey(existing.entityId, entityId)
        return {
          ...existing,
          entityId,
          entityCode: master.code,
        }
      }
      return {
        entityId: master.id,
        entityCode: master.code,
        steps: [],
        currentStepIndex: 0,
      }
    })

    const knownCodes = new Set(orderedMasters.map((m) => m.code.trim().toLowerCase()))
    const extras = block.entityTabs
      .filter((tab) => !knownCodes.has(tab.entityCode.trim().toLowerCase()))
      .sort((a, b) => compareEntityCodes(a.entityCode, b.entityCode))

    const mergedTabs = [...entityTabs, ...extras]
    const activeStillValid = mergedTabs.some((tab) => tab.entityId === block.activeEntityId)
    return {
      ...block,
      entityTabs: mergedTabs,
      activeEntityId: activeStillValid
        ? block.activeEntityId
        : (mergedTabs[0]?.entityId ?? ''),
    }
  })

  return {
    ...estimation,
    electrificationPercentByEntity,
    percentageMasterIdByEntity,
    blocks,
  }
}

export async function withMasterEntityTabs(estimation: Estimation): Promise<Estimation> {
  const sectorId = estimation.blocks[0]?.sectorId || 'residential-buildings'
  const masters = await getEntities(sectorId)
  return ensureEntityTabs(estimation, masters)
}
