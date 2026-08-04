import { useEffect, useRef, useState } from 'react'
import { Input } from '@/shared/components/ui/Input'
import { RadioGroup } from '@/shared/components/ui/RadioGroups'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { computeAutomaticValue } from '../calculations/calculations'
import {
  formatAmount,
  formatAmountInput,
  parseFormattedAmount,
} from '../utils/formatAmount'
import type { Phase } from '../types/estimation'

export function PhaseCard({
  phase,
  stepAmount,
  errors,
  onChange,
  onRemove,
  canRemove,
}: {
  phase: Phase
  stepAmount: number
  errors: Record<string, string>
  onChange: (patch: Partial<Phase>) => void
  onRemove?: () => void
  canRemove?: boolean
}) {
  const isAuto = phase.calculationMode === 'automatic'
  const calculatedValue =
    isAuto && phase.percentage !== null
      ? computeAutomaticValue(stepAmount, phase.percentage)
      : phase.value

  const [valueDraft, setValueDraft] = useState(() => formatAmount(phase.value))
  const valueFocused = useRef(false)

  useEffect(() => {
    if (valueFocused.current) return
    setValueDraft(formatAmount(phase.value))
  }, [phase.id, phase.value])

  function handleValueInput(raw: string) {
    const formatted = formatAmountInput(raw)
    if (formatted === null) return
    setValueDraft(formatted)

    const parsed = parseFormattedAmount(formatted)
    if (parsed == null) {
      onChange({ value: null })
      return
    }
    if (parsed < 0) return
    onChange({ value: parsed })
  }

  function commitValue() {
    const parsed = parseFormattedAmount(valueDraft)
    if (parsed == null) {
      setValueDraft('')
      onChange({ value: null })
      return
    }
    if (parsed < 0) {
      setValueDraft(formatAmount(phase.value))
      return
    }
    setValueDraft(formatAmount(parsed))
    onChange({ value: parsed })
  }

  const phaseLabel = (
    <div
      className="flex h-9 w-11 shrink-0 items-center justify-center rounded-[4px] border border-[#D1D5DB] bg-[#F9FAFB] text-sm font-semibold text-[--color-portal-navy]"
      aria-label={`Phase ${phase.phaseType || '—'}`}
    >
      {phase.phaseType || '—'}
    </div>
  )

  const removeBtn =
    onRemove && canRemove ? (
      <button
        type="button"
        className="flex h-9 w-5 shrink-0 items-center justify-center"
        aria-label="Remove phase"
        onClick={onRemove}
      >
        <MaterialIcon name="cancel" size={20} className="text-[--color-portal-purple]" />
      </button>
    ) : (
      <div className="h-9 w-5 shrink-0" aria-hidden />
    )

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 rounded-lg bg-white p-3">
      <RadioGroup
        name={`mode-${phase.id}`}
        legend="Calculation Mode"
        value={phase.calculationMode}
        onChange={(v) => onChange({ calculationMode: v as Phase['calculationMode'] })}
        options={[
          { value: 'manual', label: 'Manual' },
          { value: 'automatic', label: 'Calculated' },
        ]}
      />

      <div className="flex items-center gap-2">
        {phaseLabel}
        {isAuto ? (
          <>
            <Input
              className="min-w-0 flex-1 w-1"
              type="number"
              min={0}
              max={100}
              step="0.1"
              suffix="%"
              aria-label="Percentage share (e.g. 20 for 20%)"
              value={phase.percentage ?? ''}
              error={errors.percentage}
              onChange={(e) =>
                onChange({
                  percentage: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
            <Input
              className="min-w-0 basis-1/2"
              type="text"
              inputMode="decimal"
              suffix="lakhs"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              aria-label="Calculated phase value"
              title="Calculated as Amount × percentage ÷ 100"
              value={phase.percentage != null ? formatAmount(calculatedValue) : ''}
            />
          </>
        ) : (
          <Input
            className="min-w-0 flex-1"
            type="text"
            inputMode="decimal"
            suffix="lakhs"
            placeholder="Enter value"
            aria-label="Phase value"
            value={valueDraft}
            error={errors.value}
            onFocus={() => {
              valueFocused.current = true
            }}
            onChange={(e) => handleValueInput(e.target.value)}
            onBlur={() => {
              valueFocused.current = false
              commitValue()
            }}
          />
        )}
        {removeBtn}
      </div>
    </div>
  )
}
