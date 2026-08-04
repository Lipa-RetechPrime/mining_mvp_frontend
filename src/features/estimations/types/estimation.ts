export type PhaseTypeCode = string
export type CalculationMode = 'manual' | 'automatic'
export type AmountMode = 'manual' | 'calculated'
/** Manual = user-entered unit cost; on_hire = persist 0 to the API. */
export type UnitCostMode = 'manual' | 'on_hire'

export interface Phase {
  id: string
  phaseType: PhaseTypeCode | ''
  calculationMode: CalculationMode
  value: number | null
  percentage: number | null
}

export interface Step {
  id: string
  /**
   * Editable header label (e.g. "Cost Item 1"). Separate from Details.
   * Omitted on older saved rows — UI falls back to "Cost Item {n}".
   */
  title?: string
  details: string
  /** Display labels for the three numeric drivers (defaults: Label 1–3). */
  fieldLabels: {
    label1: string
    label2: string
    label3: string
  }
  manpower: number | null
  qrts: number | null
  unitCost: number | null
  amount: number | null
  /** Omitted values from older saved estimations are treated as calculated. */
  amountMode?: AmountMode
  /** Omitted values from older saved estimations are treated as manual. */
  unitCostMode?: UnitCostMode
  phases: Phase[]
  /**
   * Per-cost-item mirror of the mine-level phase limit (for add-phase checks).
   * Set from Estimation.phaseLimit; omitted on older saved rows.
   */
  phaseLimit?: number | null
  phasePageIndex: number
}

export interface EntityTabState {
  entityId: string
  entityCode: string
  steps: Step[]
  currentStepIndex: number
}

export interface EstimationBlock {
  id: string
  sectorId: string
  sectorName: string
  activeEntityId: string
  entityTabs: EntityTabState[]
}

export interface Estimation {
  id?: string
  /** Backend mine identifier used by investment create / update / delete APIs. */
  mine_id?: string
  siteSubtitle: string
  appendixLabel: string
  /** Plain-text life of mine from the mine record (listing display). */
  lifeOfMine?: string | null
  /**
   * Max phases allowed per cost item for this mine.
   * Persisted via create-mine-year (`year` = phase limit).
   */
  phaseLimit?: number | null
  /**
   * Design / electrification surcharge percent per entity (entityId → %).
   * Edited on create/update mine forms; persisted via create/update-percentage APIs.
   */
  electrificationPercentByEntity?: Record<string, number>
  /** Backend percentage_master_id keyed by entity_id (UUID). */
  percentageMasterIdByEntity?: Record<string, string>
  blocks: EstimationBlock[]
  createdAt?: string
  updatedAt?: string
}

export interface Sector {
  id: string
  name: string
}

export interface EntityMaster {
  id: string
  code: string
  sectorId: string
}

export interface PhaseTypeMaster {
  code: PhaseTypeCode
  label: string
}

export type FieldErrors = Record<string, string>

export type EstimationStatus =
  | "idle"
  | "loading"
  | "saving"
  | "saved"
  | "error"

export interface EstimationWorkspaceState {
  estimation: Estimation
  errors: FieldErrors
  status: EstimationStatus
  statusMessage: string
  entitiesBySector: Record<string, EntityMaster[]>
  phaseTypes: PhaseTypeMaster[]
}
