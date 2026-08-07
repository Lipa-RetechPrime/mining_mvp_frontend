'use client'

import { Button } from '@/shared/components/ui/Button'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import {
  isAdhocOutsourcing,
  isFullOutsourcing,
  isPartialOutsourcing,
  type OutsourcingContributionSettings,
} from './OutsourcingPartialContext'

type Metric = {
  icon: string
  iconWrapClass: string
  iconClass: string
  label: string
  value: string
  subtext: string
}

function kindDescription(
  settings: OutsourcingContributionSettings,
): string {
  if (isFullOutsourcing(settings)) return 'Full outsourcing'
  if (isAdhocOutsourcing(settings)) return 'Adhoc outsourcing'
  return 'Partial outsourcing'
}

function metricsFor(
  settings: OutsourcingContributionSettings,
): Metric[] {
  if (isFullOutsourcing(settings)) {
    return [
      {
        icon: 'trending_up',
        iconWrapClass: 'bg-[#FDE8E8]',
        iconClass: 'text-[#E11D48]',
        label: 'Escalation',
        value: `${settings.escalationPercent}%`,
        subtext: 'On outsourced portion',
      },
      {
        icon: 'calendar_month',
        iconWrapClass: 'bg-[#E8F8EF]',
        iconClass: 'text-[#059669]',
        label: 'Payback Period',
        value: `${settings.paybackPeriodYears} yr.`,
        subtext: 'For outsourcing setup',
      },
      {
        icon: 'flag',
        iconWrapClass: 'bg-[#EEE8FF]',
        iconClass: 'text-[--color-portal-purple]',
        label: 'Payback Start',
        value: settings.paybackStartPhase,
        subtext: 'First payback phase',
      },
    ]
  }

  if (isAdhocOutsourcing(settings)) {
    return [
      {
        icon: 'edit_note',
        iconWrapClass: 'bg-[#EEE8FF]',
        iconClass: 'text-[--color-portal-purple]',
        label: 'Adhoc Outsourcing',
        value: 'Manual',
        subtext: 'Enter contributions per phase',
      },
    ]
  }

  if (isPartialOutsourcing(settings)) {
    return [
      {
        icon: 'attach_money',
        iconWrapClass: 'bg-[#EEE8FF]',
        iconClass: 'text-[--color-portal-purple]',
        label: 'Contribution',
        value: `${settings.contributionPercentage}%`,
        subtext: 'Contribution',
      },
      {
        icon: 'trending_up',
        iconWrapClass: 'bg-[#FDE8E8]',
        iconClass: 'text-[#E11D48]',
        label: 'Escalation',
        value: `${settings.escalationPercent}%`,
        subtext: 'On outsourced portion',
      },
      {
        icon: 'calendar_month',
        iconWrapClass: 'bg-[#E8F8EF]',
        iconClass: 'text-[#059669]',
        label: 'Payback Period',
        value: `${settings.paybackPeriodYears} yr.`,
        subtext: 'For outsourcing setup',
      },
    ]
  }

  return []
}

export function OutsourcingConfigBanner({
  settings,
  onEdit,
}: {
  settings: OutsourcingContributionSettings
  onEdit: () => void
}) {
  const metrics = metricsFor(settings)

  return (
    <section
      className="mb-4 overflow-hidden rounded-xl  bg-white"
      aria-label="Outsourcing configuration"
    >
      <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:gap-0 lg:px-5 lg:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-[18rem] lg:pr-5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEE8FF]"
            aria-hidden
          >
            <MaterialIcon
              name="groups"
              size={22}
              className="text-[--color-portal-purple]"
            />
          </div>
          <div className="min-w-0">
            <p className="text-base font-medium text-[--color-portal-navy]">
            {kindDescription(settings)}
            </p>
            {/* <p className="mt-0.5 text-xs leading-snug text-[--text-color]">
              {kindDescription(settings)}
            </p> */}
          </div>
        </div>

        {metrics.length > 0 ? (
          <div className="flex min-w-0 flex-[2] flex-wrap items-stretch gap-4  pt-4 lg:border-l lg:border-t-0 border-r border-[--separator] lg:px-6 lg:pt-0">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="flex min-w-[8.5rem] flex-1 items-start gap-2.5"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${metric.iconWrapClass}`}
                  aria-hidden
                >
                  <MaterialIcon
                    name={metric.icon}
                    size={18}
                    className={metric.iconClass}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[--text-color]">
                    {metric.label}
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-[--color-portal-navy]">
                    {metric.value}
                  </p>
                  {/* <p className="text-[11px] text-[--text-color]">
                    {metric.subtext}
                  </p> */}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex shrink-0 flex-col items-stretch gap-1  pt-4 sm:items-end lg:pl-5 lg:pt-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="whitespace-nowrap"
            onClick={onEdit}
          >
            <MaterialIcon name="edit" size={16} />
            Edit outsourcing configuration
          </Button>
          <p className="text-center text-[11px] text-[--text-color] sm:text-right">
            {/* Update outsourcing parameters */}
          </p>
        </div>
      </div>
    </section>
  )
}
