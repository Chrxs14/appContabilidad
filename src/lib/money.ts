/**
 * Format a number as currency. Defaults to USD / en-US.
 * Pass currency + locale explicitly when the user has changed the app setting.
 */
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Returns a formatter function bound to a specific currency/locale. */
export function createCurrencyFormatter(currency: string, locale: string) {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return (amount: number) => formatter.format(amount)
}

/** Parse a localized currency string back to a number (best-effort). */
export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}
