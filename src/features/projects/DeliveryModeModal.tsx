'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/Button'
import { Modal } from '@/shared/components/ui/Modal'
import {
  DELIVERY_MODE_OPTIONS,
  type DeliveryModeCode,
} from './deliveryMode'

export interface DeliveryModeModalProps {
  open: boolean
  initialMode?: DeliveryModeCode | null
  /** Optional cost-function name shown in the title. */
  functionName?: string | null
  confirming?: boolean
  /**
   * When true (changing an existing mode), allow dismiss so tables stay usable.
   * First-time choice stays required.
   */
  dismissible?: boolean
  onClose?: () => void
  onConfirm: (mode: DeliveryModeCode) => void
}

/** Choice modal — Ownership or Outsourcing. */
export function DeliveryModeModal({
  open,
  initialMode = null,
  functionName = null,
  confirming = false,
  dismissible = false,
  onClose,
  onConfirm,
}: DeliveryModeModalProps) {
  const [selected, setSelected] = useState<DeliveryModeCode | null>(
    initialMode,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelected(initialMode)
    setError(null)
  }, [open, initialMode])

  function handleContinue() {
    if (!selected) {
      setError('Select Ownership or Outsourcing to continue.')
      return
    }
    onConfirm(selected)
  }

  const title = functionName?.trim()
    ? `Select delivery mode — ${functionName.trim()}`
    : 'Select delivery mode'

  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      dismissible={dismissible}
      onClose={dismissible ? onClose : undefined}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dismissible && onClose ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={confirming}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            onClick={handleContinue}
            disabled={confirming || !selected}
          >
            {confirming ? 'Continuing…' : 'Continue'}
          </Button>
        </div>
      }
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">Delivery mode</legend>
        <p className="text-sm text-gray-600">
          Select how this cost function is delivered. A choice is required to
          continue. Other functions can use a different mode.
        </p>
        <div className="space-y-2">
          {DELIVERY_MODE_OPTIONS.map((option) => {
            const inputId = `delivery-mode-${option.code}`
            const checked = selected === option.code
            return (
              <label
                key={option.code}
                htmlFor={inputId}
                className={[
                  'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition',
                  checked
                    ? 'border-portal-purple bg-portal-purple/5'
                    : 'border-portal-border hover:border-slate-300',
                ].join(' ')}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="delivery-mode"
                  value={option.code}
                  checked={checked}
                  onChange={() => {
                    setSelected(option.code)
                    setError(null)
                  }}
                  className="h-4 w-4 accent-portal-purple"
                />
                <span className="text-sm font-medium text-portal-navy">
                  {option.label}
                </span>
              </label>
            )
          })}
        </div>
        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </fieldset>
    </Modal>
  )
}
