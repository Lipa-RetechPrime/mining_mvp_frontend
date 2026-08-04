import { useState } from 'react'
import { Input } from '@/shared/components/ui/Input'
import { DEFAULT_INITIAL_PHASE_COUNT, PHASE_ADD_BATCH_SIZE } from '../phases/phaseTypes'

export function MinePhaseLimitInput({
  value,
  error,
  onChange,
  readOnly = false,
}: {
  value: number | null | undefined
  error?: string
  onChange: (phaseLimit: number | null) => void
  /** Editable only while creating a mine; read-only when updating. */
  readOnly?: boolean
}) {
  const [draft, setDraft] = useState(() => (value == null ? '' : String(value)))
  const [prevValue, setPrevValue] = useState(value)

  // Sync draft when the parent value changes (render-time adjustment, not an effect).
  if (value !== prevValue) {
    setPrevValue(value)
    setDraft(value == null ? '' : String(value))
  }

  function commitDraft(raw: string) {
    if (readOnly) return
    const trimmed = raw.trim()
    if (trimmed === '') {
      setDraft('')
      onChange(null)
      return
    }
    const parsed = Math.floor(Number(trimmed))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraft(value == null ? '' : String(value))
      return
    }
    const committed = Math.max(DEFAULT_INITIAL_PHASE_COUNT, parsed)
    setDraft(String(committed))
    onChange(committed)
  }

  return (
    <div className="mb-5 max-w-xs">
      <Input
        label="Life of mine (years)"
        type="number"
        min={DEFAULT_INITIAL_PHASE_COUNT}
        placeholder={`Maximum number of phases`}
        value={draft}
        error={error}
        readOnly={readOnly}
        onChange={(event) => {
          if (!readOnly) setDraft(event.target.value)
        }}
        onBlur={() => commitDraft(draft)}
      />
      <p className="mt-1.5 text-xs text-[--text-color]">
        {readOnly
          ? 'Set when the mine was created and cannot be changed.'
          : `Applies to every cost item. Use Add phases in each cost item to create up to ${PHASE_ADD_BATCH_SIZE} at a time (minimum ${DEFAULT_INITIAL_PHASE_COUNT}).`}
      </p>
    </div>
  )
}
