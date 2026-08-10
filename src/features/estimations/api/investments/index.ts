/** Investment API surface — types, domain helpers, mappers, and HTTP service. */

export type {
  ApiResponse,
  InvestmentCostItemDto,
  InvestmentDto,
  InvestmentEntityDto,
  InvestmentInputDto,
  InvestmentListResponse,
  InvestmentPhasingDto,
  MapMode,
  OverallCostItemDto,
  OverallEntityDto,
  OverallListData,
  OverallListResponse,
  OverallPhaseTotalDto,
} from './types'

export {
  appendCostItem,
  applyMinePhaseLimitToBlocks,
  asUuidOrNull,
  cleanUuid,
  isStepPopulated,
  isUuid,
  removeCostItem,
  withApiIds,
  withMinePhaseLimit,
} from './domain'

export {
  ensureEntityTabs,
  mapDtoToEstimation,
  mapEstimationToDto,
  scopeEstimationToInvestmentType,
  withDerivedAutomaticPercentages,
  withMasterEntityTabs,
} from './mappers'

export {
  addCostItemToEstimation,
  addCostItemsToEstimation,
  apiErrorMessage,
  assertApiSuccess,
  buildExcelDownloadPayload,
  createEstimation,
  createMineYear,
  deleteEstimation,
  downloadEstimationExcel,
  fetchInvestments,
  fetchOverallList,
  getEstimation,
  invalidateEstimationsListCache,
  listEstimations,
  removeCostItemFromEstimation,
  updateEstimation,
} from './service'
export type {
  ExcelDownloadInput,
  ExcelDownloadPayload,
} from './service'

export {
  createPercentage,
  getPercentage,
  getPercentagesByMine,
  savePercentagesForEntities,
  updatePercentage,
} from './electrification'
export type {
  CreatePercentagePayload,
  EntityPercentageTarget,
  PercentageRecord,
  UpdatePercentagePayload,
} from './electrification'
