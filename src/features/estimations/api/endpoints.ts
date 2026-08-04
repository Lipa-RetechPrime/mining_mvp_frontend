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
    functionAttributes: '/functions/attributes',
    mineWiseFunctionList: '/functions/mine-wise-function-list'
  },
} as const
