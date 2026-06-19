import { describe, expect, it } from 'vitest'
import { formatCurrency, parseCurrencyInput, createCurrencyFormatter } from './money'

describe('formatCurrency', () => {
  it('formats positive amount in USD', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats negative amount', () => {
    expect(formatCurrency(-99.5)).toBe('-$99.50')
  })

  it('rounds to two decimal places', () => {
    expect(formatCurrency(1.999)).toBe('$2.00')
  })

  it('supports MXN locale', () => {
    const result = formatCurrency(1500, 'MXN', 'es-MX')
    expect(result).toContain('1')
    expect(result).toContain('500')
  })
})

describe('createCurrencyFormatter', () => {
  it('returns a reusable formatter', () => {
    const fmt = createCurrencyFormatter('USD', 'en-US')
    expect(fmt(100)).toBe('$100.00')
    expect(fmt(0)).toBe('$0.00')
  })
})

describe('parseCurrencyInput', () => {
  it('strips currency symbols', () => {
    expect(parseCurrencyInput('$1,234.56')).toBe(1234.56)
  })

  it('returns 0 for empty string', () => {
    expect(parseCurrencyInput('')).toBe(0)
  })

  it('handles negative values', () => {
    expect(parseCurrencyInput('-50.00')).toBe(-50)
  })
})
