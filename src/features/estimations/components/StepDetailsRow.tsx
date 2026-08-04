import { useState, type KeyboardEvent } from 'react'
import { ModePills } from '@/shared/components/ui/ModePills'
import { Input } from '@/shared/components/ui/Input'
import { Textarea } from '@/shared/components/ui/Textarea'
import { Button } from '@/shared/components/ui/Button'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import {
  formatAmount,
  formatAmountInput,
  parseFormattedAmount,
} from '../utils/formatAmount'
import { computeAmount } from '../calculations/calculations'
import type { AmountMode, Step, UnitCostMode } from '../types/estimation'

function displayInteger(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  return String(Math.trunc(value))
}

/** Block decimal point and other non-integer number-input characters. */
function blockNonIntegerKeys(event: KeyboardEvent<HTMLInputElement>) {
  if (
    event.key === '.' ||
    event.key === ',' ||
    event.key === 'e' ||
    event.key === 'E' ||
    event.key === '+' ||
    event.key === '-'
  ) {
    event.preventDefault()
  }
}

/** Keep digits only so pasted decimals cannot slip through. */
function integerInputValue(raw: string): string {
  return raw.replace(/\D/g, '')
}

const DEFAULT_LABELS = {
  label1: 'Manpower',
  label2: 'QRTS',
  label3: 'Unit Cost',
} as const

export function StepDetailsRow({
  step,
  stepNumber,
  errors,
  onChange,
  onLabelChange,
  onAmountModeChange,
  onUnitCostModeChange,
  onBlurRecompute,
  onRemove,
  collapsed = false,
  onToggleCollapse,
}: {
  step: Step
  stepNumber: number
  errors: Record<string, string>
  onChange: (
    field: 'title' | 'details' | 'manpower' | 'qrts' | 'unitCost' | 'amount',
    value: string,
  ) => void
  onLabelChange: (key: 'label1' | 'label2' | 'label3', value: string) => void
  onAmountModeChange: (mode: AmountMode) => void
  onUnitCostModeChange: (mode: UnitCostMode) => void
  onBlurRecompute: () => void
  onRemove?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const err = (field: string) => errors[field]
  const labels = DEFAULT_LABELS
  void onLabelChange
  const amountMode: AmountMode = step.amountMode === 'manual' ? 'manual' : 'calculated'
  const isManualAmount = amountMode === 'manual'
  const unitCostMode: UnitCostMode =
    step.unitCostMode === 'on_hire' ? 'on_hire' : 'manual'
  const isOnHire = unitCostMode === 'on_hire'
  const effectiveUnitCost = isOnHire ? 0 : step.unitCost
  const defaultTitle = `Cost Item ${stepNumber}`
  const collapsedHeader = step.details.trim() || defaultTitle
  const calculatedAmountDraft =
    step.qrts != null && effectiveUnitCost != null
      ? formatAmount(computeAmount(step.qrts, effectiveUnitCost))
      : ''

  // Local drafts so typing "52." / "1,234.56" is not rewritten while focused.
  const [unitCostDraft, setUnitCostDraft] = useState(() =>
    formatAmount(isOnHire ? 0 : step.unitCost),
  )
  const [amountDraft, setAmountDraft] = useState(() =>
    isManualAmount ? formatAmount(step.amount) : calculatedAmountDraft,
  )
  const [unitCostFocused, setUnitCostFocused] = useState(false)
  const [amountFocused, setAmountFocused] = useState(false)
  const [prevUnitCost, setPrevUnitCost] = useState(step.unitCost)
  const [prevUnitCostMode, setPrevUnitCostMode] = useState(unitCostMode)
  const [prevAmountKey, setPrevAmountKey] = useState(
    `${step.id}:${step.amount}:${step.qrts}:${effectiveUnitCost}:${amountMode}`,
  )

  if (unitCostMode !== prevUnitCostMode) {
    setPrevUnitCostMode(unitCostMode)
    setUnitCostDraft(formatAmount(isOnHire ? 0 : step.unitCost))
  }

  if (!unitCostFocused && !isOnHire && step.unitCost !== prevUnitCost) {
    setPrevUnitCost(step.unitCost)
    setUnitCostDraft(formatAmount(step.unitCost))
  }

  const amountKey = `${step.id}:${step.amount}:${step.qrts}:${effectiveUnitCost}:${amountMode}`
  if (!amountFocused && amountKey !== prevAmountKey) {
    setPrevAmountKey(amountKey)
    setAmountDraft(
      isManualAmount ? formatAmount(step.amount) : calculatedAmountDraft,
    )
  }

  function handleUnitCostInput(raw: string) {
    if (isOnHire) return
    const formatted = formatAmountInput(raw)
    if (formatted !== null) setUnitCostDraft(formatted)
  }

  function handleAmountInput(raw: string) {
    const formatted = formatAmountInput(raw)
    if (formatted !== null) setAmountDraft(formatted)
  }

  function commitUnitCost() {
    if (isOnHire) {
      setUnitCostDraft(formatAmount(0))
      onChange('unitCost', '0')
      onBlurRecompute()
      return
    }
    const parsed = parseFormattedAmount(unitCostDraft)
    if (parsed == null) {
      setUnitCostDraft('')
      onChange('unitCost', '')
      onBlurRecompute()
      return
    }
    if (parsed < 0) {
      setUnitCostDraft(formatAmount(step.unitCost))
      onBlurRecompute()
      return
    }
    setUnitCostDraft(formatAmount(parsed))
    onChange('unitCost', String(parsed))
    onBlurRecompute()
  }

  function commitAmount() {
    if (!isManualAmount) return
    const parsed = parseFormattedAmount(amountDraft)
    if (parsed == null) {
      setAmountDraft('')
      onChange('amount', '')
      return
    }
    if (parsed < 0) {
      setAmountDraft(formatAmount(step.amount))
      return
    }
    setAmountDraft(formatAmount(parsed))
    onChange('amount', String(parsed))
  }

  return (
    <section className={collapsed ? 'mb-0' : 'mb-6'}>
      <div className="flex items-center justify-between gap-3 rounded-[6px] border border-portal-border bg-gray-50/80 px-3 py-2.5  cursor-pointer" onClick={onToggleCollapse}>
        <div className="flex min-w-0 flex-1 items-center gap-1.5" >
          {onToggleCollapse ? (
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center rounded-sm text-[#8B5CF6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/40"
              aria-expanded={!collapsed}
              aria-label={
                collapsed
                  ? `Expand ${collapsedHeader}`
                  : `Collapse ${collapsedHeader}`
              }
            >
              <MaterialIcon
                name={collapsed ? 'expand_more' : 'expand_less'}
                size={20}
              />
            </button>
          ) : (
            <MaterialIcon name="check_circle" size={18} className="shrink-0 text-[#8B5CF6]" />
          )}
          {/* Expanded: blank header. Collapsed: Details value. */}
          <span
            className="min-w-0 flex-1 break-words max-w-[1200px] text-sm font-semibold text-[#8B5CF6]"
            title={collapsed ? collapsedHeader : undefined}
          >
            {collapsed ? collapsedHeader : '\u00A0'}
          </span>
        </div>
        {onRemove ? (
          <Button
            variant="ghost"
            className="!border !border-red-200 !bg-red-50 !px-3 !py-1.5 !text-red-700 hover:!bg-red-100 hover:!text-red-800"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            aria-label={`Remove ${collapsedHeader}`}
          >
            <MaterialIcon name="delete" size={16} className="text-red-600" />
            Remove
          </Button>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-4">
          <Textarea
            className="min-w-0 flex-1 basis-[16rem]"
            label="Details"
            placeholder="Enter Cost Item Details"
            value={step.details}
            error={err('details')}
            minRows={1}
            maxRows={12}
            collapseWhenBlurred
            onChange={(e) => onChange('details', e.target.value)}
          />
          <Input
            className="min-w-[300px] basis-[300px] shrink-0 grow-0"
            label={labels.label1 || DEFAULT_LABELS.label1}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            value={displayInteger(step.manpower)}
            error={err('manpower')}
            onKeyDown={blockNonIntegerKeys}
            onChange={(e) => onChange('manpower', integerInputValue(e.target.value))}
            onBlur={onBlurRecompute}
          />
          <Input
            className="min-w-[300px] basis-[300px] shrink-0 grow-0"
            label={labels.label2 || DEFAULT_LABELS.label2}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            value={displayInteger(step.qrts)}
            error={err('qrts')}
            onKeyDown={blockNonIntegerKeys}
            onChange={(e) => onChange('qrts', integerInputValue(e.target.value))}
            onBlur={onBlurRecompute}
          />
          <div className="flex min-w-[300px] basis-[300px] shrink-0 grow-0 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium leading-none text-[#6B7280]">
                {labels.label3 || DEFAULT_LABELS.label3}
              </span>
              <ModePills
                key={`unit-cost-mode-${step.id}-${unitCostMode}`}
                name={`unit-cost-mode-${step.id}`}
                legend="Unit cost mode"
                value={unitCostMode}
                onChange={(value) => onUnitCostModeChange(value as UnitCostMode)}
                options={[
                  { value: 'on_hire', label: 'On hire' },
                  { value: 'manual', label: 'Manual' },
                ]}
              />
            </div>
            <Input
              type="text"
              inputMode="decimal"
              suffix="lakhs"
              placeholder="0"
              value={isOnHire ? formatAmount(0) : unitCostDraft}
              readOnly={isOnHire}
              tabIndex={isOnHire ? -1 : undefined}
              aria-readonly={isOnHire}
              aria-label={labels.label3 || DEFAULT_LABELS.label3}
              error={err('unitCost')}
              onFocus={() => {
                if (!isOnHire) setUnitCostFocused(true)
              }}
              onChange={(e) => handleUnitCostInput(e.target.value)}
              onBlur={() => {
                setUnitCostFocused(false)
                commitUnitCost()
              }}
            />
          </div>
          <div className="flex min-w-[300px] basis-[300px] shrink-0 grow-0 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium leading-none text-[#6B7280]">Amount</span>
              <ModePills
                key={`amount-mode-${step.id}-${amountMode}`}
                name={`amount-mode-${step.id}`}
                legend="Amount calculation mode"
                value={amountMode}
                onChange={(value) => onAmountModeChange(value as AmountMode)}
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'calculated', label: 'Calculated' },
                ]}
              />
            </div>
            <Input
              type="text"
              inputMode="decimal"
              suffix="lakhs"
              value={amountDraft}
              readOnly={!isManualAmount}
              tabIndex={isManualAmount ? undefined : -1}
              aria-readonly={!isManualAmount}
              aria-label="Amount"
              error={err('amount')}
              onFocus={() => {
                if (isManualAmount) setAmountFocused(true)
              }}
              onChange={(e) => {
                if (!isManualAmount) return
                handleAmountInput(e.target.value)
              }}
              onBlur={() => {
                setAmountFocused(false)
                commitAmount()
              }}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
