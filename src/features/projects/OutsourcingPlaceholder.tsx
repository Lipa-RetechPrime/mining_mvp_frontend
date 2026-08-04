'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SECTOR_CATALOG } from '@/features/estimations/api/master'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import type { PhaseTypeMaster } from '@/shared/types'
import {
  FULL_CONTRIBUTION_OPTIONS,
  PARTIAL_AGENT_OPTIONS,
  createEmptyOutsourcingConfig,
  getStoredOutsourcingConfig,
  setStoredOutsourcingConfig,
  validateOutsourcingConfig,
  type OutsourcingConfig,
  type OutsourcingContributionKind,
  type OutsourcingFieldErrors,
} from './outsourcingConfig'

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function RadioCard({
  name,
  value,
  checked,
  label,
  description,
  onChange,
}: {
  name: string
  value: string
  checked: boolean
  label: string
  description?: string
  onChange: () => void
}) {
  const id = `${name}-${value}`
  return (
    <label
      htmlFor={id}
      className={[
        'flex cursor-pointer gap-3 rounded-md border px-3 py-3 transition',
        checked
          ? 'border-portal-purple bg-portal-purple/5'
          : 'border-portal-border hover:border-slate-300',
      ].join(' ')}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-portal-purple"
      />
      <span>
        <span className="block text-sm font-medium text-portal-navy">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-gray-600">{description}</span>
        ) : null}
      </span>
    </label>
  )
}

export function OutsourcingPlaceholder({
  projectId,
  projectName,
  phaseTypes = [],
  onChangeMode,
}: {
  projectId: string
  projectName: string
  phaseTypes?: PhaseTypeMaster[]
  onChangeMode?: () => void
}) {
  const searchParams = useSearchParams()
  const [config, setConfig] = useState<OutsourcingConfig>(() =>
    createEmptyOutsourcingConfig(),
  )
  const [errors, setErrors] = useState<OutsourcingFieldErrors>({})
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  const currentFunctionId =
    searchParams.get('sector') || SECTOR_CATALOG[0]?.id || ''
  const currentFunction = useMemo(
    () =>
      SECTOR_CATALOG.find((sector) => sector.id === currentFunctionId) ??
      SECTOR_CATALOG[0],
    [currentFunctionId],
  )

  useEffect(() => {
    const stored = getStoredOutsourcingConfig(projectId)
    setConfig(stored ?? createEmptyOutsourcingConfig())
    setErrors({})
    setSavedMessage(null)
    setHydrated(true)
  }, [projectId])

  // Clear field-level escalation errors when switching cost functions in the nav.
  useEffect(() => {
    setErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith('escalation.')) delete next[key]
      }
      return next
    })
  }, [currentFunctionId])

  const phaseOptions = useMemo(
    () =>
      [...phaseTypes].sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true }),
      ),
    [phaseTypes],
  )

  function patchConfig(partial: Partial<OutsourcingConfig>) {
    setSavedMessage(null)
    setConfig((prev) => ({ ...prev, ...partial }))
  }

  function setContributionKind(kind: OutsourcingContributionKind) {
    setSavedMessage(null)
    setErrors({})
    setConfig((prev) => ({ ...prev, contributionKind: kind }))
  }

  function handleSave() {
    const nextErrors = validateOutsourcingConfig(config, {
      currentFunctionId:
        currentFunction?.id || currentFunctionId || SECTOR_CATALOG[0]?.id,
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setStoredOutsourcingConfig(projectId, config)
    setSavedMessage('Outsourcing configuration saved.')
  }

  if (!hydrated) {
    return (
      <div className="rounded-lg bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-200/60">
        Loading outsourcing configuration…
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-lg bg-white px-5 py-6 shadow-sm ring-1 ring-gray-200/60 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-portal-navy">
            Outsourcing configuration
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Configure contribution for{' '}
            <span className="font-medium text-portal-navy">
              {projectName || 'this project'}
            </span>
            .
          </p>
        </div>
        {onChangeMode ? (
          <Button type="button" variant="ghost" size="sm" onClick={onChangeMode}>
            Change delivery mode
          </Button>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-portal-navy">
          Contribution by outsourcing agent
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <RadioCard
            name="contribution-kind"
            value="partial"
            checked={config.contributionKind === 'partial'}
            label="Partial contribution"
            description="Agent covers part of the investment; escalation is set per cost function."
            onChange={() => setContributionKind('partial')}
          />
          <RadioCard
            name="contribution-kind"
            value="full"
            checked={config.contributionKind === 'full'}
            label="Full contribution"
            description="Agent fully funds via a contribution model (e.g. flat rate)."
            onChange={() => setContributionKind('full')}
          />
        </div>
      </fieldset>

      {config.contributionKind === 'partial' ? (
        <div className="space-y-4 border-t border-portal-border pt-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-portal-navy">
              Outsourcing agent
            </legend>
            <div className="grid gap-2 sm:max-w-md">
              {/* {PARTIAL_AGENT_OPTIONS.map((agent) => (
                <RadioCard
                  key={agent.code}
                  name="partial-agent"
                  value={agent.code}
                  checked={config.partialAgent === agent.code}
                  label={agent.label}
                  onChange={() =>
                    patchConfig({ partialAgent: agent.code })
                  }
                />
              ))} */}
              {/* <p className="text-sm font-medium text-portal-navy">External Agent</p> */}
            </div>
            {errors.partialAgent ? (
              <p className="text-xs text-red-600" role="alert">
                {errors.partialAgent}
              </p>
            ) : null}
          </fieldset>

          <div className="flex gap-4">
          <div className="w-full">
            <Input
              label="Payback period"
              type="number"
              min={0}
              step={1}
              suffix="years"
              required
              placeholder="e.g. 10"
              value={
                config.paybackPeriodYears != null
                  ? String(config.paybackPeriodYears)
                  : ''
              }
              error={errors.paybackPeriodYears}
              onChange={(event) =>
                patchConfig({
                  paybackPeriodYears: parseOptionalNumber(event.target.value),
                })
              }
            />
          </div>

          <div className="w-full">
            <Input
              label={`Escalation percentage — ${currentFunction?.name ?? 'current function'}`}
              type="number"
              min={0}
              step={0.1}
              suffix="%"
              required
              placeholder="0"
              value={
                currentFunction &&
                config.escalationByFunction?.[currentFunction.id] != null
                  ? String(config.escalationByFunction[currentFunction.id])
                  : ''
              }
              error={
                currentFunction
                  ? errors[`escalation.${currentFunction.id}`]
                  : undefined
              }
              onChange={(event) => {
                if (!currentFunction) return
                patchConfig({
                  escalationByFunction: {
                    ...(config.escalationByFunction ?? {}),
                    [currentFunction.id]: parseOptionalNumber(
                      event.target.value,
                    ),
                  },
                })
              }}
            />
            <p className="mt-1.5 text-xs text-gray-600">
              Applies only to this cost function. Switch Cost Functions in the
              side nav to set a different percentage per function.
            </p>
          </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 border-t border-portal-border pt-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-portal-navy">
              Contribution model
            </legend>
            <div className="grid gap-2 sm:max-w-md">
              {/* {FULL_CONTRIBUTION_OPTIONS.map((model) => (
                <RadioCard
                  key={model.code}
                  name="full-model"
                  value={model.code}
                  checked={config.fullContributionModel === model.code}
                  label={model.label}
                  onChange={() =>
                    patchConfig({ fullContributionModel: model.code })
                  }
                />
              ))} */}
            </div>
            {errors.fullContributionModel ? (
              <p className="text-xs text-red-600" role="alert">
                {errors.fullContributionModel}
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Payback period"
              type="number"
              min={0}
              step={1}
              suffix="years"
              required
              placeholder="e.g. 10"
              value={
                config.paybackPeriodYears != null
                  ? String(config.paybackPeriodYears)
                  : ''
              }
              error={errors.paybackPeriodYears}
              onChange={(event) =>
                patchConfig({
                  paybackPeriodYears: parseOptionalNumber(event.target.value),
                })
              }
            />
            <Input
              label="Escalation percentage"
              type="number"
              min={0}
              step={0.1}
              suffix="%"
              required
              placeholder="e.g. 5"
              value={
                config.escalationPercent != null
                  ? String(config.escalationPercent)
                  : ''
              }
              error={errors.escalationPercent}
              onChange={(event) =>
                patchConfig({
                  escalationPercent: parseOptionalNumber(event.target.value),
                })
              }
            />
            <div className="flex w-full flex-col gap-1">
              <label
                htmlFor="payback-start-phase"
                className="text-xs font-medium leading-none text-gray-500"
              >
                Phase from which payback starts
                <span className="text-red-600"> *</span>
              </label>
              <select
                id="payback-start-phase"
                className={[
                  'h-9 rounded-[4px] border bg-white px-3 text-sm text-portal-navy outline-none transition',
                  'focus:border-portal-purple focus:ring-1 focus:ring-portal-purple/30',
                  errors.paybackStartPhase
                    ? 'border-red-500'
                    : 'border-gray-300',
                ].join(' ')}
                value={config.paybackStartPhase ?? ''}
                onChange={(event) =>
                  patchConfig({
                    paybackStartPhase: event.target.value || null,
                  })
                }
              >
                <option value="">Select phase</option>
                {phaseOptions.map((phase) => (
                  <option key={phase.code} value={phase.code}>
                    {phase.label || phase.code}
                  </option>
                ))}
              </select>
              {errors.paybackStartPhase ? (
                <span className="text-[11px] leading-tight text-red-600" role="alert">
                  {errors.paybackStartPhase}
                </span>
              ) : phaseOptions.length === 0 ? (
                <span className="text-[11px] text-amber-700">
                  No phases available from phase master yet.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-portal-border pt-4">
        {savedMessage ? (
          <p className="mr-auto text-sm text-emerald-700">{savedMessage}</p>
        ) : null}
        <Button type="button" variant="primary" onClick={handleSave}>
          Save configuration
        </Button>
      </div>
    </div>
  )
}
