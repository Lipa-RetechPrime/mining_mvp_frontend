import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/shared/components/ui/Button'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import {
  buildOverallTableRows,
  withFullPaybackOverlay,
  withPartialPaybackOverlay,
} from '../utils/overallTable'
import { formatAmount } from '../utils/formatAmount'
import type { OverallListData } from '../api/investments/types'
import { resolvePhaseCodeFromIdOrName } from '@/features/estimations/api/phases'
import { normalizeCatalogPhaseCode } from '../phases/phaseTypes'
import {
  isFullOutsourcing,
  isPartialOutsourcing,
  useOutsourcingPartial,
} from '@/features/projects/OutsourcingPartialContext'

function formatNum(value: number | null | undefined): string {
  return formatAmount(value)
}

function rowClassName(
  kind: ReturnType<typeof buildOverallTableRows>['rows'][number]['kind'],
): string {
  switch (kind) {
    case 'section-header':
      return 'bg-gray-100 font-semibold text-[--color-portal-navy]'
    case 'subtotal':
    case 'design-charge':
    case 'section-total':
      return 'bg-gray-50/90 font-semibold text-portal-title'
    case 'entity-total':
      return 'border-t-2 border-portal-title bg-gray-100 font-bold text-portal-title'
    default:
      return 'hover:bg-gray-50/40'
  }
}

function FormulaCaption({ text }: { text?: string | null }) {
  if (!text?.trim()) return null
  return (
    <span className="mt-0.5 block max-w-[9rem] text-[10px] font-normal leading-tight text-gray-500 normal-case tracking-normal">
      {text}
    </span>
  )
}

/** Read-only overall sheet — electrification % is edited only on create/update mine forms. */
export function OverallCostTable({
  data,
  phaseLimit,
  onRequestDelete,
  showFormulas = false,
}: {
  data: OverallListData
  /** Mine life-of-mine cap; payback distribution must not exceed this. */
  phaseLimit?: number | null
  /** When set, shows an Actions column with delete on cost-item rows (entity tabs). */
  onRequestDelete?: (costItemId: string) => void
  /**
   * Entity tabs only: show “Phase value × contributor %” and
   * “Escalated remainder”. Overall tab keeps this off.
   */
  showFormulas?: boolean
}) {
  const outsourcing = useOutsourcingPartial()
  const subtotalInfoTitle = isPartialOutsourcing(outsourcing)
    ? 'This value is the summation of all contributed and payback amounts in different phases'
    : isFullOutsourcing(outsourcing)
      ? 'This value is the summation of payback amounts in different phases'
      : null
  const showActions = typeof onRequestDelete === 'function'
  const rawFullStart =
    isFullOutsourcing(outsourcing) && outsourcing.paybackStartPhase
      ? outsourcing.paybackStartPhase.trim()
      : ''
  const catalogFullStart = normalizeCatalogPhaseCode(rawFullStart)
  const [resolvedFullStart, setResolvedFullStart] = useState<string | null>(
    catalogFullStart,
  )

  useEffect(() => {
    let cancelled = false
    if (!rawFullStart) {
      setResolvedFullStart(null)
      return
    }
    if (catalogFullStart) {
      setResolvedFullStart(catalogFullStart)
      return
    }
    void (async () => {
      try {
        const code = await resolvePhaseCodeFromIdOrName(rawFullStart)
        if (cancelled) return
        setResolvedFullStart(normalizeCatalogPhaseCode(code) ?? code)
      } catch {
        if (!cancelled) setResolvedFullStart(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [rawFullStart, catalogFullStart])

  const { rows, phaseColumns } = useMemo(() => {
    const built = buildOverallTableRows(data)
    if (isFullOutsourcing(outsourcing)) {
      const start =
        catalogFullStart ?? resolvedFullStart ?? outsourcing.paybackStartPhase
      if (!start || !normalizeCatalogPhaseCode(start)) {
        return built
      }
      return withFullPaybackOverlay(built, {
        escalationPercent: Number(outsourcing.escalationPercent),
        paybackPeriodYears: Number(outsourcing.paybackPeriodYears),
        paybackStartPhase: normalizeCatalogPhaseCode(start) ?? start,
        phaseLimit,
      })
    }
    if (isPartialOutsourcing(outsourcing)) {
      return withPartialPaybackOverlay(built, {
        contributionPercentage: Number(outsourcing.contributionPercentage),
        escalationPercent: Number(outsourcing.escalationPercent),
        paybackPeriodYears: Number(outsourcing.paybackPeriodYears),
        phaseLimit,
      })
    }
    return built
  }, [
    data,
    outsourcing,
    phaseLimit,
    catalogFullStart,
    resolvedFullStart,
  ])

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-portal-border px-6 py-10 text-center text-sm text-gray-500">
        No cost items yet across entity tabs.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-portal-border">
      <div className="flex items-baseline justify-between gap-3 border-b border-portal-border bg-white px-4 py-3 sm:px-5">
        <h3 className="text-center text-sm font-semibold text-[--color-portal-navy] sm:text-base">
          Estimated investment on {data.function_name || 'Residential buildings'}
        </h3>
        <span className="shrink-0 text-xs font-medium text-[--text-color]">Rs lakh</span>
      </div>

      <table className="w-full min-w-[880px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-portal-border bg-gray-50/80 font-semibold uppercase tracking-wide text-[--text-color]">
            <th className="w-14 border border-portal-border px-2 py-2 text-center  text-xs">Sl no</th>
            <th className="min-w-[220px] border border-portal-border px-3 py-2 text-xs">Details</th>
            <th className="border border-portal-border px-3 py-2 text-right text-xs">Manpower</th>
            <th className="border border-portal-border px-3 py-2 text-right text-xs">Qrts</th>
            <th className="border border-portal-border px-3 py-2 text-right text-xs">Unit cost</th>
            <th className="border border-portal-border px-3 py-2 text-right text-xs">Amount</th>
            {phaseColumns.length > 0 ? (
              <th
                colSpan={phaseColumns.length}
                className="border border-portal-border px-3 py-2 text-center text-xs"
              >
                Phasing of investment
              </th>
            ) : null}
            {showActions ? (
              <th className="border border-portal-border px-3 py-2 text-right text-xs">Actions</th>
            ) : null}
          </tr>
          {phaseColumns.length > 0 ? (
            <tr className="border-b border-portal-border bg-gray-50/80 font-semibold uppercase tracking-wide text-[--text-color]">
              <th colSpan={6} className="border border-portal-border px-2 py-1.5" />
              {phaseColumns.map((phaseType) => (
                <th
                  key={phaseType}
                  className="border border-portal-border px-3 py-1.5 text-right"
                >
                  {phaseType}
                </th>
              ))}
              {showActions ? (
                <th className="border border-portal-border px-2 py-1.5" />
              ) : null}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.kind}-${row.details}-${index}`} className={rowClassName(row.kind)}>
              <td className="border border-portal-border px-2 py-2 text-center tabular-nums text-gray-700">
                {row.kind === 'item' ? row.slNo : ''}
              </td>
              <td
                className={`border border-portal-border px-3 py-2 whitespace-pre-wrap max-w-[250px] truncate ${
                  row.kind === 'section-header' || row.kind === 'entity-total'
                    ? 'font-semibold uppercase'
                    : 'font-semibold text-gray-800'
                }`}
                title={
                  row.kind === 'subtotal' && subtotalInfoTitle
                    ? undefined
                    : row.details
                }
              >
                {row.kind === 'subtotal' && subtotalInfoTitle ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>{row.details}</span>
                    <span
                      className="inline-flex shrink-0 text-gray-500 hover:text-[--color-portal-navy]"
                      title={subtotalInfoTitle}
                      aria-label={subtotalInfoTitle}
                    >
                      <MaterialIcon name="info" size={14} />
                    </span>
                  </span>
                ) : (
                  row.details
                )}
              </td>
              <td className="border border-portal-border px-3 py-2 text-right tabular-nums text-gray-700">
                {row.kind === 'item' || row.kind === 'subtotal'
                  ? Math.round(row.manpower ?? 0)
                  : ''}
              </td>
              <td className="border border-portal-border px-3 py-2 text-right tabular-nums text-gray-700">
                {row.kind === 'item' || row.kind === 'subtotal' ? Math.round(row.qrts ?? 0) : ''}
              </td>
              <td className="border border-portal-border px-3 py-2 text-right tabular-nums text-gray-700">
                {row.kind === 'item' ? formatNum(row.unitCost) : ''}
              </td>
              <td className="border border-portal-border px-3 py-2 text-right tabular-nums font-medium text-[--color-portal-navy]">
                {row.amount != null ? (
                  showFormulas && row.amountFormula ? (
                    <div className="flex flex-col items-end">
                      <span>{formatNum(row.amount)}</span>
                      <FormulaCaption text={row.amountFormula} />
                    </div>
                  ) : (
                    formatNum(row.amount)
                  )
                ) : (
                  ''
                )}
              </td>
              {phaseColumns.map((phaseType) => {
                const value = row.phaseValues[phaseType]
                const formula = showFormulas
                  ? row.phaseFormulas?.[phaseType]
                  : null
                return (
                  <td
                    key={phaseType}
                    className="border border-portal-border px-3 py-2 text-right tabular-nums text-gray-700"
                  >
                    {showFormulas && formula ? (
                      <div className="flex flex-col items-end">
                        <span>{formatNum(value)}</span>
                        <FormulaCaption text={formula} />
                      </div>
                    ) : (
                      formatNum(value)
                    )}
                  </td>
                )
              })}
              {showActions ? (
                <td className="border border-portal-border px-3 py-2 text-right">
                  {row.kind === 'item' && row.costItemId ? (
                    <Button
                      variant="ghost"
                      className="!px-2 !py-1.5 !text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => onRequestDelete?.(row.costItemId!)}
                      aria-label={`Delete cost item ${row.details}`}
                    >
                      <MaterialIcon name="delete" size={14} />
                    </Button>
                  ) : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
