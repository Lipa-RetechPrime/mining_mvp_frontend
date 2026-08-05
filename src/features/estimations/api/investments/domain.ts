import type { Estimation, Step } from '../../types/estimation'
import { generateUuid } from '../../utils/uuid'

/** True when a step has user-entered content (not just the empty factory default). */
export function isStepPopulated(step: Step): boolean {
  if (step.details.trim()) return true
  if (step.manpower != null || step.qrts != null || step.unitCost != null) return true
  if (step.amount != null && step.amount > 0) return true
  return step.phases.some(
    (phase) =>
      Boolean(phase.phaseType) &&
      (phase.value != null || phase.percentage != null),
  )
}

/** Append a cost item to an entity tab, dropping empty placeholder steps. */
export function appendCostItem(
  estimation: Estimation,
  entityId: string,
  step: Step,
): Estimation {
  return {
    ...estimation,
    blocks: estimation.blocks.map((block, index) => {
      if (index !== 0) return block
      return {
        ...block,
        activeEntityId: entityId,
        entityTabs: block.entityTabs.map((tab) => {
          const populated = tab.steps.filter(isStepPopulated)
          if (tab.entityId !== entityId) {
            return { ...tab, steps: populated }
          }
          const steps = [...populated, step]
          return { ...tab, steps, currentStepIndex: steps.length - 1 }
        }),
      }
    }),
  }
}

/** Remove one cost item from an entity tab; keeps the estimation even if the tab becomes empty. */
export function removeCostItem(
  estimation: Estimation,
  entityId: string,
  stepId: string,
): Estimation {
  return {
    ...estimation,
    blocks: estimation.blocks.map((block, index) => {
      if (index !== 0) return block
      return {
        ...block,
        activeEntityId: entityId,
        entityTabs: block.entityTabs.map((tab) => {
          if (tab.entityId !== entityId) {
            return { ...tab, steps: tab.steps.filter(isStepPopulated) }
          }
          const steps = tab.steps.filter((step) => step.id !== stepId && isStepPopulated(step))
          return {
            ...tab,
            steps,
            currentStepIndex: Math.max(0, steps.length - 1),
          }
        }),
      }
    }),
  }
}

export function cleanUuid(id: string): string {
  const clean = id.replace(/^(blk|step)-/, '')
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(clean)) {
    return clean
  }
  return generateUuid()
}

export function isUuid(id: string): boolean {
  const clean = id.replace(/^(blk|step)-/, '')
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)
}

/** Strip `blk-`/`step-` prefixes and return a bare UUID, or null if invalid. */
export function asUuidOrNull(id: string | null | undefined): string | null {
  if (!id?.trim()) return null
  const clean = id.trim().replace(/^(blk|step)-/, '')
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    clean,
  )
    ? clean
    : null
}

/** Persist the same UUIDs we send to the API so later updates hit the same rows. */
export function withApiIds(estimation: Estimation): Estimation {
  return {
    ...estimation,
    blocks: estimation.blocks.map((block) => ({
      ...block,
      id: cleanUuid(block.id),
      entityTabs: block.entityTabs.map((tab) => ({
        ...tab,
        steps: tab.steps.map((step) => ({
          ...step,
          id: cleanUuid(step.id),
        })),
      })),
    })),
  }
}

export function applyMinePhaseLimitToBlocks(
  blocks: Estimation['blocks'],
  phaseLimit: number | null,
): Estimation['blocks'] {
  return blocks.map((block) => ({
    ...block,
    entityTabs: block.entityTabs.map((tab) => ({
      ...tab,
      steps: tab.steps.map((step) => ({
        ...step,
        phaseLimit,
      })),
    })),
  }))
}

/** Apply mine-level max phases onto the estimation root and every cost-item step. */
export function withMinePhaseLimit(
  estimation: Estimation,
  phaseLimit: number | null | undefined,
): Estimation {
  const limit =
    phaseLimit == null || !Number.isFinite(phaseLimit) || phaseLimit <= 0
      ? null
      : Math.floor(phaseLimit)
  return {
    ...estimation,
    phaseLimit: limit,
    blocks: applyMinePhaseLimitToBlocks(estimation.blocks, limit),
  }
}
