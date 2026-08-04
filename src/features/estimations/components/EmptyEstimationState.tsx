import { Button } from '@/shared/components/ui/Button'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'

export function EmptyEstimationState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex min-h-[min(28rem,70vh)] flex-col items-center justify-center px-4 py-16 text-center">
      <span
        className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[5px] bg-[--bg-light] text-white"
        aria-hidden
      >
        <MaterialIcon name="assignment_add" size={24} className="text-[--color-portal-navy]" />
      </span>
      <h2 className="text-[22px] font-semibold tracking-tight text-[--color-portal-navy]">
        No cost estimations yet
      </h2>
      <p className="mt-2 max-w-md text-sm text-[--text-color]">
        Get started by creating your first cost estimation for this site.
      </p>
      <Button variant="primary" className="mt-8 !px-6 !py-2.5" onClick={onAdd}>
        <span className="text-base leading-none">+</span>
        Add New Cost Estimation
      </Button>
    </div>
  )
}
