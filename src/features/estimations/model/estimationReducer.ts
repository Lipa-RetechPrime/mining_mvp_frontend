import { computeAmount, computeAutomaticValue } from '../calculations/calculations'
import { applyPhasePatch } from '../phases/phasePatch'
import { createEmptyBlock, createEmptyPhase, createEmptyStep } from '../utils/factories'
import {
  DEFAULT_INITIAL_PHASE_COUNT,
  appendTypedPhaseBatch,
  clampPhasesToLimit,
  createTypedPhases,
  nextPhaseBatchCount,
  parsePhaseTypeCode,
} from '../phases/phaseTypes'
import type {
  CalculationMode,
  EntityMaster,
  Estimation,
  FieldErrors,
  AmountMode,
  PhaseTypeCode,
  PhaseTypeMaster,
  UnitCostMode,
} from '../types/estimation'

export interface EstimationState {
  estimation: Estimation
  errors: FieldErrors
  status: 'idle' | 'loading' | 'saving' | 'saved' | 'error'
  statusMessage: string
  entitiesBySector: Record<string, EntityMaster[]>
  phaseTypes: PhaseTypeMaster[]
  /** True after local edits since last load/save — used before delivery-mode switches. */
  dirty: boolean
}

export type EstimationAction =
  | { type: 'SET_ESTIMATION'; payload: Estimation }
  | { type: 'SET_ENTITIES'; sectorId: string; entities: EntityMaster[] }
  | { type: 'SET_PHASE_TYPES'; phaseTypes: PhaseTypeMaster[] }
  | { type: 'ADD_BLOCK'; sectorId: string; sectorName: string; entities: EntityMaster[] }
  | { type: 'SET_ACTIVE_ENTITY'; blockId: string; entityId: string }
  | {
      type: 'UPDATE_STEP_FIELD'
      blockId: string
      entityId: string
      stepId: string
      field: 'title' | 'details' | 'manpower' | 'qrts' | 'unitCost' | 'amount'
      value: string | number
    }
  | {
      type: 'UPDATE_STEP_FIELD_LABEL'
      blockId: string
      entityId: string
      stepId: string
      key: 'label1' | 'label2' | 'label3'
      value: string
    }
  | { type: 'RECOMPUTE_STEP'; blockId: string; entityId: string; stepId: string }
  | {
      type: 'SET_STEP_AMOUNT_MODE'
      blockId: string
      entityId: string
      stepId: string
      amountMode: AmountMode
    }
  | {
      type: 'SET_STEP_UNIT_COST_MODE'
      blockId: string
      entityId: string
      stepId: string
      unitCostMode: UnitCostMode
    }
  | { type: 'ADD_STEP'; blockId: string; entityId: string }
  | { type: 'REMOVE_STEP'; blockId: string; entityId: string; stepId: string }
  | { type: 'SET_STEP_INDEX'; blockId: string; entityId: string; index: number }
  | {
      type: 'INIT_STEP_PHASES'
      blockId: string
      entityId: string
      stepId: string
      phaseLimit: number
    }
  | { type: 'SET_MINE_PHASE_LIMIT'; phaseLimit: number | null }
  | {
      type: 'SET_ELECTRIFICATION_PERCENT'
      entityId: string
      percent: number | null
    }
  | { type: 'ADD_PHASE'; blockId: string; entityId: string; stepId: string; count?: number }
  | { type: 'REMOVE_PHASE'; blockId: string; entityId: string; stepId: string; phaseId: string }
  | {
      type: 'UPDATE_PHASE'
      blockId: string
      entityId: string
      stepId: string
      phaseId: string
      patch: Partial<{
        phaseType: PhaseTypeCode | ''
        calculationMode: CalculationMode
        value: number | null
        percentage: number | null
      }>
    }
  | { type: 'SET_PHASE_PAGE'; blockId: string; entityId: string; stepId: string; pageIndex: number }
  | { type: 'SET_ERRORS'; errors: FieldErrors }
  | { type: 'SET_STATUS'; status: EstimationState['status']; message?: string }

function mutateStep(
  state: EstimationState,
  blockId: string,
  entityId: string,
  stepId: string,
  updater: (step: import('../types/estimation').Step) => void,
): EstimationState {
  return {
    ...state,
    estimation: {
      ...state.estimation,
      blocks: state.estimation.blocks.map((block) => {
        if (block.id !== blockId) return block
        return {
          ...block,
          entityTabs: block.entityTabs.map((tab) => {
            if (tab.entityId !== entityId) return tab
            return {
              ...tab,
              steps: tab.steps.map((step) => {
                if (step.id !== stepId) return step
                const next = { ...step, phases: step.phases.map((p) => ({ ...p })) }
                updater(next)
                return next
              }),
            }
          }),
        }
      }),
    },
  }
}

function recomputeStepAmounts(step: import('../types/estimation').Step): void {
  if (step.amountMode === 'manual') return
  const unitCost = step.unitCostMode === 'on_hire' ? 0 : step.unitCost
  step.amount = computeAmount(step.qrts, unitCost)
  for (const phase of step.phases) {
    if (phase.calculationMode === 'automatic' && phase.percentage !== null) {
      phase.value = computeAutomaticValue(step.amount, phase.percentage)
    }
  }
}

function clearErrors(errors: FieldErrors, keys: string[]): FieldErrors {
  if (!keys.some((key) => key in errors)) return errors
  const next = { ...errors }
  for (const key of keys) delete next[key]
  return next
}

function clearOutOfOrderPhaseTypes(step: import('../types/estimation').Step): void {
  const highestIndexByPrefix: Partial<Record<'C' | 'P', number>> = {}

  for (const phase of step.phases) {
    const parsed = phase.phaseType ? parsePhaseTypeCode(phase.phaseType) : null
    if (!parsed) continue

    const highestIndex = highestIndexByPrefix[parsed.prefix] ?? 0
    if (parsed.index < highestIndex) {
      phase.phaseType = ''
      continue
    }

    highestIndexByPrefix[parsed.prefix] = parsed.index
  }
}

function normalizeMinePhaseLimit(phaseLimit: number | null): number | null {
  if (phaseLimit == null || !Number.isFinite(phaseLimit) || phaseLimit <= 0) return null
  // Do not bump to the minimum here — that rewrote "2" → "8" while typing "25" as "85".
  return Math.floor(phaseLimit)
}

function createStepWithMinePhaseLimit(phaseLimit: number | null): import('../types/estimation').Step {
  const step = createEmptyStep()
  step.phaseLimit = phaseLimit
  // Phases stay empty until the user clicks Add phases.
  return step
}

function applyMinePhaseLimitToEstimation(
  estimation: Estimation,
  phaseLimit: number | null,
): Estimation {
  return {
    ...estimation,
    phaseLimit,
    blocks: estimation.blocks.map((block) => ({
      ...block,
      entityTabs: block.entityTabs.map((tab) => ({
        ...tab,
        steps: tab.steps.map((step) => ({
          ...step,
          phaseLimit,
          // Keep existing phases (clamped); never auto-create on limit set.
          phases: clampPhasesToLimit(
            step.phases.map((p) => ({ ...p })),
            phaseLimit,
          ),
        })),
      })),
    })),
  }
}

export function createInitialState(estimation: Estimation): EstimationState {
  return {
    estimation,
    errors: {},
    status: 'idle',
    statusMessage: '',
    entitiesBySector: {},
    phaseTypes: [],
    dirty: false,
  }
}

const DIRTYING_ACTIONS = new Set<EstimationAction['type']>([
  'ADD_BLOCK',
  'UPDATE_STEP_FIELD',
  'UPDATE_STEP_FIELD_LABEL',
  'RECOMPUTE_STEP',
  'SET_STEP_AMOUNT_MODE',
  'SET_STEP_UNIT_COST_MODE',
  'ADD_STEP',
  'REMOVE_STEP',
  'INIT_STEP_PHASES',
  'SET_MINE_PHASE_LIMIT',
  'SET_ELECTRIFICATION_PERCENT',
  'ADD_PHASE',
  'REMOVE_PHASE',
  'UPDATE_PHASE',
])

export function estimationReducer(
  state: EstimationState,
  action: EstimationAction,
): EstimationState {
  switch (action.type) {
    case 'SET_ESTIMATION':
      return {
        ...state,
        estimation: action.payload,
        errors: {},
        status: 'idle',
        statusMessage: '',
        dirty: false,
      }
    case 'SET_ENTITIES':
      return {
        ...state,
        entitiesBySector: { ...state.entitiesBySector, [action.sectorId]: action.entities },
      }
    case 'SET_PHASE_TYPES':
      return { ...state, phaseTypes: action.phaseTypes }
    case 'ADD_BLOCK':
      return {
        ...state,
        estimation: {
          ...state.estimation,
          blocks: [
            ...state.estimation.blocks,
            createEmptyBlock(action.sectorId, action.sectorName, action.entities),
          ],
        },
      }
    case 'SET_ACTIVE_ENTITY':
      return {
        ...state,
        errors: {},
        status: 'idle',
        statusMessage: '',
        estimation: {
          ...state.estimation,
          blocks: state.estimation.blocks.map((b) =>
            b.id === action.blockId ? { ...b, activeEntityId: action.entityId } : b,
          ),
        },
      }
    case 'UPDATE_STEP_FIELD':
      return {
        ...mutateStep(state, action.blockId, action.entityId, action.stepId, (step) => {
          if (action.field === 'details' || action.field === 'title') {
            step[action.field] = String(action.value)
          } else if (action.field === 'amount') {
            const raw = String(action.value).trim()
            step.amount = raw === '' ? null : Number(raw)
          } else {
            const raw = String(action.value).trim()
            step[action.field] = raw === '' ? null : Number(raw)
          }
        }),
        errors: clearErrors(state.errors, [
          `${action.blockId}.${action.entityId}.${action.stepId}.${action.field}`,
          ...(action.field === 'amount' ||
          action.field === 'qrts' ||
          action.field === 'unitCost'
            ? [`${action.blockId}.${action.entityId}.${action.stepId}.phaseAmountSum`]
            : []),
        ]),
      }
    case 'UPDATE_STEP_FIELD_LABEL':
      return mutateStep(state, action.blockId, action.entityId, action.stepId, (step) => {
        const labels = step.fieldLabels ?? {
          label1: 'Label 1',
          label2: 'Label 2',
          label3: 'Label 3',
        }
        step.fieldLabels = { ...labels, [action.key]: action.value }
      })
    case 'RECOMPUTE_STEP':
      return mutateStep(state, action.blockId, action.entityId, action.stepId, recomputeStepAmounts)
    case 'SET_STEP_AMOUNT_MODE':
      return mutateStep(state, action.blockId, action.entityId, action.stepId, (step) => {
        step.amountMode = action.amountMode
        if (action.amountMode === 'calculated') recomputeStepAmounts(step)
      })
    case 'SET_STEP_UNIT_COST_MODE':
      return mutateStep(state, action.blockId, action.entityId, action.stepId, (step) => {
        step.unitCostMode = action.unitCostMode
        if (action.unitCostMode === 'on_hire') {
          step.unitCost = 0
        }
        recomputeStepAmounts(step)
      })
    case 'ADD_STEP':
      return {
        ...state,
        estimation: {
          ...state.estimation,
          blocks: state.estimation.blocks.map((block) => {
            if (block.id !== action.blockId) return block
            return {
              ...block,
              entityTabs: block.entityTabs.map((tab) => {
                if (tab.entityId !== action.entityId) return tab
                const nextStep = createStepWithMinePhaseLimit(state.estimation.phaseLimit ?? null)
                nextStep.title = `Cost Item ${tab.steps.length + 1}`
                const steps = [...tab.steps, nextStep]
                return { ...tab, steps, currentStepIndex: steps.length - 1 }
              }),
            }
          }),
        },
      }
    case 'REMOVE_STEP':
      return {
        ...state,
        estimation: {
          ...state.estimation,
          blocks: state.estimation.blocks.map((block) => {
            if (block.id !== action.blockId) return block
            return {
              ...block,
              entityTabs: block.entityTabs.map((tab) => {
                if (tab.entityId !== action.entityId) return tab
                // Always allow remove; if last item, replace with a fresh empty step.
                if (tab.steps.length <= 1) {
                  const reset = createStepWithMinePhaseLimit(
                    state.estimation.phaseLimit ?? null,
                  )
                  reset.title = 'Cost Item 1'
                  return {
                    ...tab,
                    steps: [reset],
                    currentStepIndex: 0,
                  }
                }
                const steps = tab.steps.filter((s) => s.id !== action.stepId)
                const currentStepIndex = Math.min(tab.currentStepIndex, steps.length - 1)
                return { ...tab, steps, currentStepIndex: Math.max(0, currentStepIndex) }
              }),
            }
          }),
        },
      }
    case 'SET_STEP_INDEX':
      return {
        ...state,
        estimation: {
          ...state.estimation,
          blocks: state.estimation.blocks.map((block) => {
            if (block.id !== action.blockId) return block
            return {
              ...block,
              entityTabs: block.entityTabs.map((tab) =>
                tab.entityId === action.entityId ? { ...tab, currentStepIndex: action.index } : tab,
              ),
            }
          }),
        },
      }
    case 'INIT_STEP_PHASES':
      return mutateStep(state, action.blockId, action.entityId, action.stepId, (step) => {
        if (step.phases.length > 0) return
        const limit = Math.max(DEFAULT_INITIAL_PHASE_COUNT, Math.floor(action.phaseLimit))
        step.phaseLimit = limit
        const initialCount = Math.min(DEFAULT_INITIAL_PHASE_COUNT, limit)
        step.phases = createTypedPhases(0, initialCount, createEmptyPhase)
      })
    case 'SET_MINE_PHASE_LIMIT': {
      const limit = normalizeMinePhaseLimit(action.phaseLimit)
      return {
        ...state,
        errors: clearErrors(state.errors, ['phaseLimit']),
        estimation: applyMinePhaseLimitToEstimation(state.estimation, limit),
      }
    }
    case 'SET_ELECTRIFICATION_PERCENT': {
      const entityId = action.entityId?.trim()
      if (!entityId) return state
      const raw = action.percent
      const percent =
        raw == null || !Number.isFinite(raw) || raw < 0
          ? null
          : Math.round(raw * 10) / 10
      const previous = state.estimation.electrificationPercentByEntity ?? {}
      const nextByEntity = { ...previous }
      if (percent == null) delete nextByEntity[entityId]
      else nextByEntity[entityId] = percent
      return {
        ...state,
        errors: clearErrors(state.errors, [`electrificationPercent.${entityId}`]),
        estimation: {
          ...state.estimation,
          electrificationPercentByEntity: nextByEntity,
        },
      }
    }
    case 'ADD_PHASE':
      return mutateStep(state, action.blockId, action.entityId, action.stepId, (step) => {
        const limit = state.estimation.phaseLimit ?? step.phaseLimit
        if (limit == null) return
        step.phaseLimit = limit
        const batch = nextPhaseBatchCount(step.phases.length, limit)
        const count =
          action.count != null && Number.isFinite(action.count)
            ? Math.min(batch, Math.max(0, Math.floor(action.count)))
            : batch
        if (count <= 0) return
        step.phases = clampPhasesToLimit(
          appendTypedPhaseBatch(step.phases, count, createEmptyPhase),
          limit,
        )
      })
    case 'REMOVE_PHASE':
      return mutateStep(state, action.blockId, action.entityId, action.stepId, (step) => {
        step.phases = step.phases.filter((p) => p.id !== action.phaseId)
      })
    case 'UPDATE_PHASE':
      return {
        ...mutateStep(state, action.blockId, action.entityId, action.stepId, (step) => {
          step.phases = step.phases.map((phase) => {
            if (phase.id !== action.phaseId) return phase
            return applyPhasePatch(phase, action.patch, step.amount ?? 0)
          })
          if ('phaseType' in action.patch) clearOutOfOrderPhaseTypes(step)
        }),
        errors: clearErrors(
          state.errors,
          Object.keys(action.patch).map(
            (field) =>
              `${action.blockId}.${action.entityId}.${action.stepId}.${action.phaseId}.${field}`,
          ).concat(
            `${action.blockId}.${action.entityId}.${action.stepId}.phaseAmountSum`,
            `${action.blockId}.${action.entityId}.${action.stepId}.paybackRoom`,
          ),
        ),
      }
    case 'SET_PHASE_PAGE':
      return mutateStep(state, action.blockId, action.entityId, action.stepId, (step) => {
        step.phasePageIndex = action.pageIndex
      })
    case 'SET_ERRORS':
      return { ...state, errors: action.errors }
    case 'SET_STATUS':
      return {
        ...state,
        status: action.status,
        statusMessage: action.message ?? '',
        dirty: action.status === 'saved' ? false : state.dirty,
      }
    default:
      return state
  }
}

/** Mark workspace dirty after user edits (used by the store wrapper). */
export function withDirtyFlag(
  previous: EstimationState,
  next: EstimationState,
  actionType: EstimationAction['type'],
): EstimationState {
  if (actionType === 'SET_ESTIMATION') return { ...next, dirty: false }
  if (actionType === 'SET_STATUS' && next.status === 'saved') {
    return { ...next, dirty: false }
  }
  if (DIRTYING_ACTIONS.has(actionType)) return { ...next, dirty: true }
  return next
}
