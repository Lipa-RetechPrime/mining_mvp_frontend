import { buildOverallTableRows } from '../utils/overallTable'
import { formatAmount } from '../utils/formatAmount'
import type { OverallListData } from '../api/investments/types'

function formatNum(value: number | null | undefined): string {
  return formatAmount(value)
}

function rowClassName(kind: ReturnType<typeof buildOverallTableRows>['rows'][number]['kind']): string {
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

/** Read-only overall sheet — electrification % is edited only on create/update mine forms. */
export function OverallCostTable({ data }: { data: OverallListData }) {
  const { rows, phaseColumns } = buildOverallTableRows(data)

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
          <tr className="border-b border-portal-border bg-gray-50/80 text-2xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="w-14 border border-portal-border px-2 py-2 text-center">Sl no</th>
            <th className="min-w-[220px] border border-portal-border px-3 py-2">Details</th>
            <th className="border border-portal-border px-3 py-2 text-right">Manpower</th>
            <th className="border border-portal-border px-3 py-2 text-right">Qrts</th>
            <th className="border border-portal-border px-3 py-2 text-right">Unit cost</th>
            <th className="border border-portal-border px-3 py-2 text-right">Amount</th>
            {phaseColumns.length > 0 ? (
              <th
                colSpan={phaseColumns.length}
                className="border border-portal-border px-3 py-2 text-center"
              >
                Phasing of investment
              </th>
            ) : null}
          </tr>
          {phaseColumns.length > 0 ? (
            <tr className="border-b border-portal-border bg-gray-50/80 text-2xs font-semibold uppercase tracking-wide text-gray-500">
              <th colSpan={6} className="border border-portal-border px-2 py-1.5" />
              {phaseColumns.map((phaseType) => (
                <th
                  key={phaseType}
                  className="border border-portal-border px-3 py-1.5 text-right"
                >
                  {phaseType}
                </th>
              ))}
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
                title={row.details}
              >
                {row.details}
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
                {row.amount != null ? formatNum(row.amount) : ''}
              </td>
              {phaseColumns.map((phaseType) => (
                <td
                  key={phaseType}
                  className="border border-portal-border px-3 py-2 text-right tabular-nums text-gray-700"
                >
                  {formatNum(row.phaseValues[phaseType])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
