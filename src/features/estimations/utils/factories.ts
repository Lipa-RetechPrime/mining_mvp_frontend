import type {
  EntityMaster,
  Estimation,
  EstimationBlock,
  EntityTabState,
  Phase,
  PhaseTypeCode,
  Step,
} from '../types/estimation'
import { generateUuid } from './uuid'

export function createId(prefix: string): string {
  return `${prefix}-${generateUuid()}`
}

export function createEmptyPhase(phaseType: PhaseTypeCode | '' = ''): Phase {
  return {
    id: createId('ph'),
    phaseType,
    calculationMode: 'manual',
    value: null,
    percentage: null,
  }
}

export function createEmptyStep(title = 'Cost Item 1'): Step {
  return {
    id: createId('step'),
    title,
    details: '',
    fieldLabels: {
      label1: 'Label 1',
      label2: 'Label 2',
      label3: 'Label 3',
    },
    manpower: null,
    qrts: null,
    unitCost: null,
    amount: null,
    amountMode: 'calculated',
    unitCostMode: 'manual',
    phases: [],
    phaseLimit: null,
    phasePageIndex: 0,
  }
}

export function createEntityTab(entity: EntityMaster): EntityTabState {
  return {
    entityId: entity.id,
    entityCode: entity.code,
    steps: [createEmptyStep()],
    currentStepIndex: 0,
  }
}

export function createEmptyBlock(
  sectorId: string,
  sectorName: string,
  entities: EntityMaster[],
): EstimationBlock {
  const tabs = entities.map(createEntityTab)
  return {
    id: createId('blk'),
    sectorId,
    sectorName,
    activeEntityId: tabs[0]?.entityId ?? '',
    entityTabs: tabs,
  }
}

export function createEmptyEstimation(
  sectorId: string,
  sectorName: string,
  entities: EntityMaster[],
): Estimation {
  return {
    siteSubtitle: 'Chuperbhita Simlong OCP',
    appendixLabel: 'APPENDIX A 2.2',
    phaseLimit: null,
    electrificationPercentByEntity: {},
    percentageMasterIdByEntity: {},
    blocks: [createEmptyBlock(sectorId, sectorName, entities)],
  }
}
