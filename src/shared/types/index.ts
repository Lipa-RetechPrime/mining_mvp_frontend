export type PhaseTypeCode = string
export type CalculationMode = 'manual' | 'automatic'
export type AmountMode = 'manual' | 'calculated'
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

    title?: string
    details: string
    fieldLabels: {
        label1: string
        label2: string
        label3: string
    }
    manpower: number | null
    qrts: number | null
    unitCost: number | null
    amount: number | null
    amountMode?: AmountMode
    unitCostMode?: UnitCostMode
    phases: Phase[]
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
    mine_id?: string
    siteSubtitle: string
    appendixLabel: string
    /** Plain-text life of mine from the mine record (listing display). */
    lifeOfMine?: string | null
    phaseLimit?: number | null
    electrificationPercentByEntity?: Record<string, number>
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
