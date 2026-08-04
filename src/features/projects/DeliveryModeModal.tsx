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
  confirming?: boolean
  onClose: () => void
  onConfirm: (mode: DeliveryModeCode) => void
}

/** Modal is radios only — Life of Mine belongs on the project listing. */
export function DeliveryModeModal({
  open,
  initialMode = null,
  confirming = false,
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

  return (
    <Modal
      open={open}
      title="Select delivery mode"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={confirming}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleContinue}
            disabled={confirming}
          >
            {confirming ? 'Continuing…' : 'Continue'}
          </Button>
        </>
      }
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">Delivery mode</legend>
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
