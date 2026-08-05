import { Badge } from '@/shared/components/ui/Badge'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'

export function EstimationBlockHeader({
  sectorName,
  appendixLabel,
  siteSubtitle,
}: {
  sectorName: string
  appendixLabel: string
  siteSubtitle: string
}) {

  return (
    <div className="mb-6 font-sans">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-gray-400">
          {appendixLabel}
        </p>
        {/* <button
          type="button"
          // className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-portal-purple text-white hover:bg-portal-purple-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple"
          aria-label="Close"
        >
          <MaterialIcon name="cancel" size={20} className="text-[--color-portal-purple]" />
        </button> */}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-portal-navy text-white"
            aria-hidden
          >
            <MaterialIcon name="apartment" size={22} className="text-white" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[22px] font-semibold leading-snug tracking-tight text-[--color-portal-navy]">
              {sectorName}
            </h2>
            <p className="mt-0.5 text-sm font-normal text-[--text-color]">{siteSubtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* <span
            className={`inline-flex items-center gap-1.5 rounded-full bg-portal-purple-soft px-3 py-1.5 text-[13px] font-medium tabular-nums ${
              isExpired ? 'text-red-600' : 'text-portal-purple-text'
            }`}
            aria-label={`Countdown ${label}`}
            role="timer"
          >
            <MaterialIcon name="schedule" size={16} />
            {label}
          </span> */}
          <Badge>All Estimations in Lakhs</Badge>
        </div>
      </div>
    </div>
  )
}
