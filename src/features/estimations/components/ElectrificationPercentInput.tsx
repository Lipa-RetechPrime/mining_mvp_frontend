import { useState } from 'react'
import { Input } from '@/shared/components/ui/Input'

/**
 * Per-entity design/electrification surcharge percent.
 * Value is user-entered — do not invent defaults. Show a saved % only when editing that entity.
 */
export function ElectrificationPercentInput({
  value,
  error,
  entityCode,
  onChange,
}: {
  value: number | null | undefined
  error?: string
  /** Active entity label shown in the helper text. */
  entityCode?: string
  onChange: (percent: number | null) => void
}) {
  const formatted =
    value != null && Number.isFinite(value) ? String(value) : ''
  const [draft, setDraft] = useState(formatted)
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(formatted)
  }

  function commitDraft(raw: string) {
    const trimmed = raw.trim()
    if (trimmed === '') {
      setDraft('')
      onChange(null)
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(formatted)
      return
    }
    const next = Math.round(parsed * 10) / 10
    setDraft(String(next))
    onChange(next)
  }

  const entityLabel = entityCode?.trim() || 'this entity'

  return (
    <div className="mb-5 max-w-xs">
      <Input
        label="Design, electrification etc @"
        type="number"
        min={0}
        step={0.1}
        suffix="%"
        placeholder="Enter percent"
        value={draft}
        error={error}
        required
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commitDraft(draft)}
      />
      <p className="mt-1.5 text-xs text-[--text-color]">
        Enter a percent for {entityLabel}. Required when phases are present.
      </p>
    </div>
  )
}
