/**
 * Matches Western thousand-separated integers (e.g. 1,234 or 12,345,678).
 * Useful when validating or finding already-formatted amount strings.
 */
export const THOUSAND_SEPARATOR_PATTERN = /\b\d{1,3}(,\d{3})+\b/g

/**
 * Format a monetary amount with 2 decimal places and thousand separators
 * (e.g. 1234567.8 → "1,234,567.80").
 */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''

  const [intPart, frac = '00'] = n.toFixed(2).split('.')
  const negative = intPart.startsWith('-')
  const digits = negative ? intPart.slice(1) : intPart
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}.${frac}`
}

/** Strip thousand separators so a formatted amount string can be parsed. */
export function parseFormattedAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '')
  if (cleaned === '' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Allow empty, digits, commas, and at most one decimal point while typing. */
export function isFormattedDecimalDraft(raw: string): boolean {
  const withoutCommas = raw.replace(/,/g, '')
  return withoutCommas === '' || /^\d*\.?\d{0,2}$/.test(withoutCommas)
}

/**
 * Format amount input live: thousand separators and up to 2 decimal digits.
 * Does not force `.00` while typing — use {@link formatAmount} on blur instead.
 * Returns null when the raw input should be rejected (e.g. third decimal digit).
 */
export function formatAmountInput(raw: string): string | null {
  const cleaned = raw.replace(/,/g, '')
  if (cleaned === '') return ''
  if (!/^\d*\.?\d{0,2}$/.test(cleaned)) return null

  const endsWithDot = cleaned.endsWith('.')
  const dotIndex = cleaned.indexOf('.')
  const intPart = dotIndex >= 0 ? cleaned.slice(0, dotIndex) : cleaned
  const decPart = dotIndex >= 0 ? cleaned.slice(dotIndex + 1) : ''

  if (intPart === '' && dotIndex >= 0) {
    if (endsWithDot) return '0.'
    return `0.${decPart}`
  }

  const intDigits = intPart.replace(/^0+(?=\d)/, '')
  const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  if (endsWithDot) return `${grouped}.`
  if (dotIndex >= 0) return `${grouped}.${decPart}`
  return grouped
}

/** Format draft on blur; returns empty string for invalid/empty input. */
export function formatAmountDraft(raw: string): string {
  const parsed = parseFormattedAmount(raw)
  if (parsed == null) return ''
  return formatAmount(parsed)
}
