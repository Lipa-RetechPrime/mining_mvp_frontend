'use client'

import { createContext, useContext } from 'react'

/** Partial outsourcing settings applied to the cost-item form / overall sheet. */
export type OutsourcingPartialSettings = {
  kind?: 'partial'
  contributionPercentage: number
  escalationPercent: number
  paybackPeriodYears: number
  functionInvestmentTypeId: string
}

/** Full outsourcing — no user contribution; payback from a chosen start phase. */
export type OutsourcingFullSettings = {
  kind: 'full'
  escalationPercent: number
  paybackPeriodYears: number
  paybackStartPhase: string
  functionInvestmentTypeId: string
}

/** Adhoc — manual contribution amounts; isolated FIT for cost items. */
export type OutsourcingAdhocSettings = {
  kind: 'adhoc'
  functionInvestmentTypeId: string
}

export type OutsourcingContributionSettings =
  | OutsourcingPartialSettings
  | OutsourcingFullSettings
  | OutsourcingAdhocSettings

const OutsourcingPartialContext =
  createContext<OutsourcingContributionSettings | null>(null)

export const OutsourcingPartialProvider = OutsourcingPartialContext.Provider

export function useOutsourcingPartial(): OutsourcingContributionSettings | null {
  return useContext(OutsourcingPartialContext)
}

export function isFullOutsourcing(
  settings: OutsourcingContributionSettings | null | undefined,
): settings is OutsourcingFullSettings {
  return settings?.kind === 'full'
}

export function isAdhocOutsourcing(
  settings: OutsourcingContributionSettings | null | undefined,
): settings is OutsourcingAdhocSettings {
  return settings?.kind === 'adhoc'
}

export function isPartialOutsourcing(
  settings: OutsourcingContributionSettings | null | undefined,
): settings is OutsourcingPartialSettings {
  return settings != null && settings.kind !== 'full' && settings.kind !== 'adhoc'
}
