/** Hard-coded for MVP — later replace with delivery-type master from API. */
export const DELIVERY_MODE_OPTIONS = [
  { code: 'ownership', label: 'Ownership' },
  { code: 'outsourcing', label: 'Outsourcing' },
] as const

export type DeliveryModeCode = (typeof DELIVERY_MODE_OPTIONS)[number]['code']

const STORAGE_PREFIX = 'mining.deliveryMode:'

export function getStoredDeliveryMode(projectId: string): DeliveryModeCode | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${projectId}`)
  if (raw === 'ownership' || raw === 'outsourcing') return raw
  return null
}

export function setStoredDeliveryMode(
  projectId: string,
  mode: DeliveryModeCode,
): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, mode)
}

export function clearStoredDeliveryMode(projectId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`)
}
