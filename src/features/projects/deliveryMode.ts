/** Hard-coded for MVP — later replace with delivery-type master from API. */
export const DELIVERY_MODE_OPTIONS = [
  { code: 'ownership', label: 'Ownership' },
  { code: 'outsourcing', label: 'Outsourcing' },
] as const

export type DeliveryModeCode = (typeof DELIVERY_MODE_OPTIONS)[number]['code']
