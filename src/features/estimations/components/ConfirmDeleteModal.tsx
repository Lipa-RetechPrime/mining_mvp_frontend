import type { ReactNode } from 'react'
import { Button } from '@/shared/components/ui/Button'
import { Modal } from '@/shared/components/ui/Modal'

export function ConfirmDeleteModal({
  open,
  title,
  message,
  deleting = false,
  confirmLabel = 'Delete',
  deletingLabel = 'Deleting…',
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  message: ReactNode
  deleting?: boolean
  confirmLabel?: string
  deletingLabel?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      backdropClassName="bg-black/30 backdrop-blur-sm"
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="!bg-red-600 hover:!bg-red-700"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? deletingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="min-w-0 text-sm leading-relaxed text-[--text-color] break-words [overflow-wrap:anywhere] [&_span]:break-all">
        {message}
      </div>
    </Modal>
  )
}
