'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getMineWiseFunctionList } from '@/features/estimations/api/master'
import {
  ensureAdhocOutsourcingStub,
  fitToFullSettings,
  fitToPartialSettings,
  getFunctionInvestmentTypeDetails,
  type FunctionInvestmentTypeRecord,
  upsertFullOutsourcingConfig,
  upsertPartialOutsourcingConfig,
} from '@/features/estimations/api/functionInvestmentType'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import type { PhaseTypeMaster } from '@/shared/types'
import {
  createEmptyOutsourcingConfig,
  validateOutsourcingConfig,
  type OutsourcingConfig,
  type OutsourcingContributionKind,
  type OutsourcingFieldErrors,
} from './outsourcingConfig'
import type { OutsourcingContributionSettings } from './OutsourcingPartialContext'
import {
  getPreferredOutsourcingKind,
  setPreferredOutsourcingKind,
} from './outsourcingPreference'

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
  className,
}: {
  name: string
  value: string
  checked: boolean
  label: string
  description?: string
  onChange: () => void
  className?: string
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
        className,
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
  onContinueToEstimation,
}: {
  projectId: string
  projectName: string
  phaseTypes?: PhaseTypeMaster[]
  onChangeMode?: () => void
  /** After a valid save, hand settings to the parent so the cost-item form opens. */
  onContinueToEstimation?: (
    kind: OutsourcingContributionKind,
    settings: OutsourcingContributionSettings,
  ) => void
}) {
  const searchParams = useSearchParams()
  const [config, setConfig] = useState<OutsourcingConfig>(() =>
    createEmptyOutsourcingConfig(),
  )
  const [errors, setErrors] = useState<OutsourcingFieldErrors>({})
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fitId, setFitId] = useState<string | null>(null)
  const [partialFitId, setPartialFitId] = useState<string | null>(null)
  const [fullFitId, setFullFitId] = useState<string | null>(null)
  const [adhocFitId, setAdhocFitId] = useState<string | null>(null)
  const [partialFitRecord, setPartialFitRecord] =
    useState<FunctionInvestmentTypeRecord | null>(null)
  const [fullFitRecord, setFullFitRecord] =
    useState<FunctionInvestmentTypeRecord | null>(null)
  const [functionCatalog, setFunctionCatalog] = useState<{ id: string; name: string }[]>([])


  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await getMineWiseFunctionList(projectId)
        if (cancelled) return
        setFunctionCatalog(
          list.map((fn) => ({
            id: fn.function_master_id,
            name: fn.function_name,
          })),
        )
      } catch {
        if (!cancelled) setFunctionCatalog([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const sectorParam = searchParams.get('sector') || ''
  const currentFunctionId = useMemo(() => {
    if (
      sectorParam &&
      functionCatalog.some((fn) => fn.id === sectorParam)
    ) {
      return sectorParam
    }
    return functionCatalog[0]?.id || ''
  }, [sectorParam, functionCatalog])
  const currentFunction = useMemo(
    () =>
      functionCatalog.find((fn) => fn.id === currentFunctionId) ?? null,
    [currentFunctionId, functionCatalog],
  )

  useEffect(() => {
    if (!projectId || !currentFunctionId) {
      setConfig(createEmptyOutsourcingConfig())
      setFitId(null)
      setPartialFitId(null)
      setFullFitId(null)
      setAdhocFitId(null)
      setPartialFitRecord(null)
      setFullFitRecord(null)
      setErrors({})
      setSavedMessage(null)
      setHydrated(Boolean(projectId))
      return
    }

    let cancelled = false
    setHydrated(false)
    void (async () => {
      try {
        const [partialFit, fullFit, adhocFit] = await Promise.all([
          getFunctionInvestmentTypeDetails(
            currentFunctionId,
            'partial-outsourcing',
          ),
          getFunctionInvestmentTypeDetails(
            currentFunctionId,
            'full-outsourcing',
          ),
          getFunctionInvestmentTypeDetails(
            currentFunctionId,
            'adhoc-outsourcing',
          ),
        ])
        if (cancelled) return

        const partialId = partialFit?.function_investment_type_id ?? null
        const fullId = fullFit?.function_investment_type_id ?? null
        const adhocId = adhocFit?.function_investment_type_id ?? null
        setPartialFitId(partialId)
        setFullFitId(fullId)
        setAdhocFitId(adhocId)
        setPartialFitRecord(partialFit)
        setFullFitRecord(fullFit)

        const fullSettings = fitToFullSettings(fullFit)
        const partialSettings = fitToPartialSettings(partialFit)
        const preferred =
          getPreferredOutsourcingKind(currentFunctionId) ??
          (partialSettings ? 'partial' : fullSettings ? 'full' : adhocId ? 'adhoc' : 'partial')

        if (preferred === 'full' && fullSettings) {
          setFitId(fullId)
          setConfig({
            ...createEmptyOutsourcingConfig(),
            contributionKind: 'full',
            paybackPeriodYears: fullSettings.paybackPeriodYears,
            escalationPercent: fullSettings.escalationPercent,
            paybackStartPhase: fullSettings.paybackStartPhase,
          })
        } else if (preferred === 'partial' && partialSettings) {
          setFitId(partialId)
          setConfig({
            ...createEmptyOutsourcingConfig(),
            contributionKind: 'partial',
            paybackPeriodYears: partialSettings.paybackPeriodYears,
            contributionPercentage: partialSettings.contributionPercentage,
            escalationPercent: partialSettings.escalationPercent,
          })
        } else if (preferred === 'adhoc') {
          setFitId(adhocId)
          setConfig({
            ...createEmptyOutsourcingConfig(),
            contributionKind: 'adhoc',
          })
        } else if (partialSettings) {
          setFitId(partialId)
          setConfig({
            ...createEmptyOutsourcingConfig(),
            contributionKind: 'partial',
            paybackPeriodYears: partialSettings.paybackPeriodYears,
            contributionPercentage: partialSettings.contributionPercentage,
            escalationPercent: partialSettings.escalationPercent,
          })
        } else if (fullSettings) {
          setFitId(fullId)
          setConfig({
            ...createEmptyOutsourcingConfig(),
            contributionKind: 'full',
            paybackPeriodYears: fullSettings.paybackPeriodYears,
            escalationPercent: fullSettings.escalationPercent,
            paybackStartPhase: fullSettings.paybackStartPhase,
          })
        } else {
          setFitId(null)
          setConfig(createEmptyOutsourcingConfig())
        }
        setErrors({})
        setSavedMessage(null)
      } catch {
        if (cancelled) return
        setFitId(null)
        setPartialFitId(null)
        setFullFitId(null)
        setAdhocFitId(null)
        setPartialFitRecord(null)
        setFullFitRecord(null)
        setConfig(createEmptyOutsourcingConfig())
      } finally {
        if (!cancelled) setHydrated(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, currentFunctionId])

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
    if (kind === 'partial') {
      const settings = fitToPartialSettings(partialFitRecord)
      setFitId(partialFitId)
      setConfig({
        ...createEmptyOutsourcingConfig(),
        contributionKind: 'partial',
        paybackPeriodYears: settings?.paybackPeriodYears ?? null,
        contributionPercentage: settings?.contributionPercentage ?? null,
        escalationPercent: settings?.escalationPercent ?? null,
      })
      return
    }
    if (kind === 'full') {
      const settings = fitToFullSettings(fullFitRecord)
      setFitId(fullFitId)
      setConfig({
        ...createEmptyOutsourcingConfig(),
        contributionKind: 'full',
        paybackPeriodYears: settings?.paybackPeriodYears ?? null,
        escalationPercent: settings?.escalationPercent ?? null,
        paybackStartPhase: settings?.paybackStartPhase ?? null,
      })
      return
    }
    setFitId(adhocFitId)
    setConfig({
      ...createEmptyOutsourcingConfig(),
      contributionKind: 'adhoc',
    })
  }

  async function handleSave() {
    const functionId = currentFunction?.id || ''
    if (!functionId || !functionCatalog.some((fn) => fn.id === functionId)) {
      setSavedMessage(null)
      setErrors({
        partialAgent:
          functionCatalog.length === 0
            ? 'No cost functions are linked to this mine yet. Open Home and select a mine that has cost functions.'
            : 'Select a valid cost function from the sidebar before saving.',
      })
      return
    }
    const nextErrors = validateOutsourcingConfig(config, {
      currentFunctionId: functionId,
      currentFunctionName: currentFunction?.name,
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    setSavedMessage(null)
    try {
      if (config.contributionKind === 'partial') {
        const saved = await upsertPartialOutsourcingConfig({
          function_master_id: functionId,
          // Never fall back to another kind's FIT id (would mutate PO ↔ FO).
          function_investment_type_id: partialFitId,
          payback_period: config.paybackPeriodYears!,
          contribution_percentage: config.contributionPercentage!,
          escalation_percentage: config.escalationPercent!,
        })
        setPartialFitId(saved.function_investment_type_id)
        setPartialFitRecord(saved)
        setFitId(saved.function_investment_type_id)
        setPreferredOutsourcingKind(functionId, 'partial')
        // Prefer API record; fall back to the form values we just saved so a
        // sparse create/update response cannot block opening the cost form.
        const fromApi = fitToPartialSettings(saved)
        const settings: OutsourcingContributionSettings = {
          kind: 'partial',
          contributionPercentage:
            fromApi?.contributionPercentage ?? config.contributionPercentage!,
          escalationPercent:
            fromApi?.escalationPercent ?? config.escalationPercent!,
          paybackPeriodYears:
            fromApi?.paybackPeriodYears ?? config.paybackPeriodYears!,
          functionInvestmentTypeId: saved.function_investment_type_id,
        }
        onContinueToEstimation?.('partial', settings)
        setSavedMessage('Configuration saved. Opening cost item form…')
      } else if (config.contributionKind === 'full') {
        const saved = await upsertFullOutsourcingConfig({
          function_master_id: functionId,
          // Never fall back to another kind's FIT id (would mutate FO ↔ PO).
          function_investment_type_id: fullFitId,
          payback_period: config.paybackPeriodYears!,
          escalation_percentage: config.escalationPercent!,
          from_payback_start: config.paybackStartPhase!,
        })
        setFullFitId(saved.function_investment_type_id)
        setFullFitRecord(saved)
        setFitId(saved.function_investment_type_id)
        setPreferredOutsourcingKind(functionId, 'full')
        const fromApi = fitToFullSettings(saved)
        const settings: OutsourcingContributionSettings = {
          kind: 'full',
          escalationPercent:
            fromApi?.escalationPercent ?? config.escalationPercent!,
          paybackPeriodYears:
            fromApi?.paybackPeriodYears ?? config.paybackPeriodYears!,
          paybackStartPhase:
            fromApi?.paybackStartPhase ?? config.paybackStartPhase!,
          functionInvestmentTypeId: saved.function_investment_type_id,
        }
        onContinueToEstimation?.('full', settings)
        setSavedMessage('Configuration saved. Opening cost item form…')
      } else {
        const saved = await ensureAdhocOutsourcingStub(functionId)
        setAdhocFitId(saved.function_investment_type_id)
        setFitId(saved.function_investment_type_id)
        setPreferredOutsourcingKind(functionId, 'adhoc')
        onContinueToEstimation?.('adhoc', {
          kind: 'adhoc',
          functionInvestmentTypeId: saved.function_investment_type_id,
        })
        setSavedMessage('Configuration saved. Opening cost item form…')
      }
    } catch (err) {
      setErrors({
        escalationPercent:
          err instanceof Error
            ? err.message
            : 'Failed to save outsourcing configuration.',
      })
    } finally {
      setSaving(false)
    }
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

      {functionCatalog.length === 0 || !currentFunctionId ? (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          No cost functions are linked to this mine yet. Pick another project
          from the list, or wait until Nest returns mine-wise functions — then
          select one in the sidebar before saving.
        </p>
      ) : null}
      {errors.partialAgent ? (
        <p className="text-sm text-red-600" role="alert">
          {errors.partialAgent}
        </p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-portal-navy">
          Contribution by outsourcing agent
        </legend>
        <div className="flex gap-2">
          <RadioCard
            name="contribution-kind"
            value="partial"
            checked={config.contributionKind === 'partial'}
            label="Partial Contribution by External Agent"
            description="Agent covers part of the investment."
            onChange={() => setContributionKind('partial')}
            className="w-full"
          />
          <RadioCard
            name="contribution-kind"
            value="full"
            checked={config.contributionKind === 'full'}
            label="Full Contribution by External Agent"
            description="Agent fully funds via a contribution model (e.g. flat rate)."
            onChange={() => setContributionKind('full')}
            className="w-full"
          />
          <RadioCard
            name="contribution-kind"
            value="adhoc"
            checked={config.contributionKind === 'adhoc'}
            label="Adhoc Contribution by External Agent"
            description="Enter the manually calculated contribution amounts."
            onChange={() => setContributionKind('adhoc')}
            className="w-full"
          />
        </div>
      </fieldset>

      {config.contributionKind === 'adhoc' ? null : config.contributionKind === 'partial' ? (
        <div className="space-y-4 border-t border-portal-border pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[10rem] flex-1">
              <Input
                label="Payback period"
                type="number"
                min={0}
                step={1}
                suffix="years"
                required
                placeholder="e.g. 3"
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

            <div className="min-w-[10rem] flex-1">
              <Input
                label="Contribution percentage"
                type="number"
                min={0}
                step={1}
                suffix="%"
                required
                placeholder="e.g. 30"
                value={
                  config.contributionPercentage != null
                    ? String(config.contributionPercentage)
                    : ''
                }
                error={errors.contributionPercentage}
                onChange={(event) =>
                  patchConfig({
                    contributionPercentage: parseOptionalNumber(
                      event.target.value,
                    ),
                  })
                }
              />
            </div>

            <div className="min-w-[10rem] flex-1">
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
            </div>
          </div>
          <p className="text-xs text-gray-600">
            After save, settings are stored via FunctionInvestmentType API and
            the cost item form opens. Phase count still follows life of mine.
          </p>
        </div>
      ) : (
        <div className="space-y-4 border-t border-portal-border pt-4">
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
          <p className="text-xs text-gray-600">
            After save, settings are stored via FunctionInvestmentType API and
            the cost item form opens. Phase values are not entered manually —
            payback is distributed on the Overall sheet from the selected start
            phase.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-portal-border pt-4">
        {savedMessage ? (
          <p className="mr-auto text-sm text-emerald-700">{savedMessage}</p>
        ) : null}
        <Button
          type="button"
          variant="primary"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving
            ? 'Saving…'
            : 'Save & continue'}
        </Button>
      </div>
    </div>
  )
}
