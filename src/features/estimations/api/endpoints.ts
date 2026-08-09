/** Paths relative to `/api` — must match Nest controllers (not the older POC investment aliases). */
export const ENDPOINTS = {
  investments: {
    list: '/investments/get-all-list',
    create: '/investments/create',
    update: '/investments/update',
    deleteMine: '/mines/delete',
    deleteCostItem: '/cost-items/delete',
    createMineYear: '/mine-years/create',
    overallList: '/investments/overall-list',
    downloadExcel: '/excel/download',
    createPercentage: '/percentages/create',
    updatePercentage: '/percentages/update',
    getPercentage: '/percentages/get',
    percentagesGetAll: '/percentages/get-all',
    functionAttributes: '/functions/attributes',
    mineWiseFunctionList: '/functions/mine-wise-function-list',
    /** Nest FunctionInvestmentType controller */
    functionInvestmentTypeCreate: '/functions/create-function-investment-type',
    functionInvestmentTypeUpdate: '/functions/update-function-investment-type',
    functionInvestmentTypeDetails: '/functions/function-investment-type-details',
    functionInvestmentTypeList: '/functions/investment-type-list',
  },
  phases: {
    list: '/phases/list',
  },
  /** Mine listing only — Manage Existing must use this, never `investments.list`. */
  mines: {
    list: '/mines/list',
  },
} as const
