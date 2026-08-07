/** Investment / overall-list API DTOs and response envelopes. */

export type InvestmentInputDto = {
  node_name: string
  value: number
}

export type InvestmentPhasingDto = {
  phase_name: string
  value: number
  calculation_mode: 'manual' | 'calculated'
  percentage?: number | null
}

export type InvestmentCostItemDto = {
  cost_item_id: string
  name: string
  /** Cost function this item belongs to (when list returns multi-function mines). */
  function_master_id?: string | null
  /** Display name for function_master_id (when list includes it per item). */
  function_name?: string | null
  /** Ownership / Partial / Full FIT — isolates phase data per delivery type. */
  function_investment_type_id?: string | null
  inputs: InvestmentInputDto[]
  amount_value: number
  /** API: calculated = Qrts × Unit Cost, manual = user-entered. Older rows may omit this. */
  amount_mode?: 'manual' | 'calculated'
  phasing: InvestmentPhasingDto[]
}

export type InvestmentEntityDto = {
  entity_id?: string
  entity_name: string
  /** Design / electrification surcharge percent for this entity. */
  percentage?: number | null
  percentage_master_id?: string | null
  costItems: InvestmentCostItemDto[]
}

export type InvestmentDto = {
  mine_id: string
  mine_name: string
  appendix_label?: string
  function_master_id: string
  function_name: string
  /** Max phases for this mine (from mine operational years). */
  phase_limit?: number | null
  /** ISO timestamps when API provides them. */
  created_at?: string | null
  updated_at?: string | null
  entities: InvestmentEntityDto[]
}

export type InvestmentListResponse = {
  success?: boolean
  statusCode?: number
  message?: string
  data?: InvestmentDto[]
}

export type ApiResponse = {
  success?: boolean
  statusCode?: number
  message?: string
  data?:
    | Array<{
        mine_id?: string
        cost_item_id?: string
        entity_id?: string
        percentage_master_id?: string
        percentage?: number
      }>
    | {
        mine_id?: string
        cost_item_id?: string
        entity_id?: string
        percentage_master_id?: string
        percentage?: number
      }
}

export type OverallPhaseTotalDto = {
  phase_name: string
  total_value: number
}

export type OverallCostItemDto = {
  name: string
  manpower: number
  qrts: number
  unit_cost: number
  amount: number
  phases: Record<string, number>
  /** Present when overall list returns FIT-scoped or mixed rows. */
  function_investment_type_id?: string | null
  cost_item_id?: string | null
}

export type OverallEntityDto = {
  entity_id?: string
  entity_name: string
  total_manpower: number
  total_qrts: number
  total_amount: number
  /** Design charge amount (entity total × percentage / 100). */
  design_percent?: number | null
  design_10_percent?: number | null
  design_amount?: number | null
  grand_total: number
  /** Design / electrification surcharge percent for this entity. */
  percentage?: number | null
  design_percentage?: number | null
  percentage_master_id?: string | null
  phases: OverallPhaseTotalDto[]
  costItems: OverallCostItemDto[]
}

export type OverallListData = {
  mine_id: string
  mine_name: string
  function_name: string
  entities: OverallEntityDto[]
  overall_grand_total: number
  overall_phase_totals: OverallPhaseTotalDto[]
  /** Mine-level design / electrification percent when API provides one. */
  electrification_percent?: number | null
  [key: string]: unknown
}

export type OverallListResponse = {
  success?: boolean
  statusCode?: number
  message?: string
  data?: OverallListData
}

export type MapMode = 'create' | 'update'
