import { Button } from '@/shared/components/ui/Button'
import { Loading } from '@/shared/components/ui/Loading'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'

export function CardFooter({
  stepCount,
  onAddStep,
  onSubmit,
  onCancel,
  submitting,
  showSubmit,
  isEditing,
}: {
  stepCount: number
  onAddStep: () => void
  onSubmit?: () => void
  onCancel?: () => void
  submitting?: boolean
  showSubmit?: boolean
  /** When true, primary action shows Update instead of Submit. */
  isEditing?: boolean
}) {
  const primaryLabel = isEditing ? 'Update' : 'Submit'

  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-portal-border pt-6">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-portal-purple-soft px-3.5 py-1.5 text-[13px] font-semibold text-portal-purple-text">
        <MaterialIcon name="show_chart" size={16} />
        {stepCount} {stepCount === 1 ? 'Cost Item' : 'Cost Items'}
      </span>

      <div className="flex flex-wrap items-center gap-3">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onAddStep} disabled={submitting}>
          + Add Cost Item
        </Button>
        {showSubmit && onSubmit ? (
          <Button
            variant="primary"
            disabled={submitting}
            onClick={onSubmit}
            aria-busy={submitting}
          >
            {submitting ? <Loading compact /> : primaryLabel}
          </Button>
        ) : null}
      </div>
    </footer>
  )
}

export function PageSubmitBar({
  onSubmit,
  submitting,
}: {
  onSubmit: () => void
  submitting: boolean
}) {
  return (
    <div className="flex justify-end gap-3">
      <Button
        variant="primary"
        disabled={submitting}
        onClick={onSubmit}
        aria-busy={submitting}
      >
        {submitting ? <Loading compact /> : 'Submit'}
      </Button>
    </div>
  )
}

export { CardFooter as StepPager }
