import type { DeliveryModeCode } from './deliveryMode'
import type { OutsourcingContributionKind } from './outsourcingConfig'

const deliveryKey = (functionMasterId: string) =>
  `mining.deliveryMode.${functionMasterId.trim()}`

const kindKey = (functionMasterId: string) =>
  `mining.outsourcingKind.${functionMasterId.trim()}`

function canUseSession(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

export function getPreferredDeliveryMode(
  functionMasterId: string,
): DeliveryModeCode | null {
  if (!canUseSession() || !functionMasterId.trim()) return null
  const raw = window.sessionStorage.getItem(deliveryKey(functionMasterId))
  if (raw === 'ownership' || raw === 'outsourcing') return raw
  return null
}

export function setPreferredDeliveryMode(
  functionMasterId: string,
  mode: DeliveryModeCode,
): void {
  if (!canUseSession() || !functionMasterId.trim()) return
  window.sessionStorage.setItem(deliveryKey(functionMasterId), mode)
}

export function getPreferredOutsourcingKind(
  functionMasterId: string,
): OutsourcingContributionKind | null {
  if (!canUseSession() || !functionMasterId.trim()) return null
  const raw = window.sessionStorage.getItem(kindKey(functionMasterId))
  if (raw === 'partial' || raw === 'full' || raw === 'adhoc') return raw
  return null
}

export function setPreferredOutsourcingKind(
  functionMasterId: string,
  kind: OutsourcingContributionKind,
): void {
  if (!canUseSession() || !functionMasterId.trim()) return
  window.sessionStorage.setItem(kindKey(functionMasterId), kind)
}
