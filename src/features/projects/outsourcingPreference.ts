import type { DeliveryModeCode } from './deliveryMode'
import type { OutsourcingContributionKind } from './outsourcingConfig'

const deliveryKey = (mineId: string, functionMasterId: string) =>
  `mining.deliveryMode.${mineId.trim()}.${functionMasterId.trim()}`

const kindKey = (mineId: string, functionMasterId: string) =>
  `mining.outsourcingKind.${mineId.trim()}.${functionMasterId.trim()}`

/** @deprecated Legacy keys were function-only (shared across mines). */
const legacyDeliveryKey = (functionMasterId: string) =>
  `mining.deliveryMode.${functionMasterId.trim()}`

const legacyKindKey = (functionMasterId: string) =>
  `mining.outsourcingKind.${functionMasterId.trim()}`

function canUseSession(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

export function getPreferredDeliveryMode(
  mineId: string,
  functionMasterId: string,
): DeliveryModeCode | null {
  if (!canUseSession() || !mineId.trim() || !functionMasterId.trim()) return null
  const raw = window.sessionStorage.getItem(
    deliveryKey(mineId, functionMasterId),
  )
  if (raw === 'ownership' || raw === 'outsourcing') return raw
  // One-time migrate legacy function-only preference into mine scope.
  const legacy = window.sessionStorage.getItem(
    legacyDeliveryKey(functionMasterId),
  )
  if (legacy === 'ownership' || legacy === 'outsourcing') {
    window.sessionStorage.setItem(
      deliveryKey(mineId, functionMasterId),
      legacy,
    )
    window.sessionStorage.removeItem(legacyDeliveryKey(functionMasterId))
    return legacy
  }
  return null
}

export function setPreferredDeliveryMode(
  mineId: string,
  functionMasterId: string,
  mode: DeliveryModeCode,
): void {
  if (!canUseSession() || !mineId.trim() || !functionMasterId.trim()) return
  window.sessionStorage.setItem(deliveryKey(mineId, functionMasterId), mode)
  window.sessionStorage.removeItem(legacyDeliveryKey(functionMasterId))
}

export function getPreferredOutsourcingKind(
  mineId: string,
  functionMasterId: string,
): OutsourcingContributionKind | null {
  if (!canUseSession() || !mineId.trim() || !functionMasterId.trim()) return null
  const raw = window.sessionStorage.getItem(kindKey(mineId, functionMasterId))
  if (raw === 'partial' || raw === 'full' || raw === 'adhoc') return raw
  const legacy = window.sessionStorage.getItem(legacyKindKey(functionMasterId))
  if (legacy === 'partial' || legacy === 'full' || legacy === 'adhoc') {
    window.sessionStorage.setItem(
      kindKey(mineId, functionMasterId),
      legacy,
    )
    window.sessionStorage.removeItem(legacyKindKey(functionMasterId))
    return legacy
  }
  return null
}

export function setPreferredOutsourcingKind(
  mineId: string,
  functionMasterId: string,
  kind: OutsourcingContributionKind,
): void {
  if (!canUseSession() || !mineId.trim() || !functionMasterId.trim()) return
  window.sessionStorage.setItem(kindKey(mineId, functionMasterId), kind)
  window.sessionStorage.removeItem(legacyKindKey(functionMasterId))
}
