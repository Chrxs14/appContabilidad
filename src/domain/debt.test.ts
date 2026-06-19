import { describe, expect, it } from 'vitest'
import {
  calcMonthlyInterest,
  calcMonthsToPayoff,
  calcTotalInterestRemaining,
  calcDebtSummary,
  calcConsolidatedDebt,
  simulatePayoff,
} from './debt'
import type { Debt } from '@/db/types'

const makeDebt = (
  id: number,
  balance: number,
  annualRate: number,
  minimumPayment: number,
  name = `Debt ${id}`,
): Debt => ({
  id,
  name,
  type: 'loan',
  currentBalance: balance,
  annualRate,
  minimumPayment,
  createdAt: new Date(),
})

describe('calcMonthlyInterest', () => {
  it('computes monthly interest correctly', () => {
    // 12% annual → 1% monthly on $1000 → $10
    expect(calcMonthlyInterest(1000, 12)).toBeCloseTo(10)
  })

  it('returns 0 for zero rate', () => {
    expect(calcMonthlyInterest(5000, 0)).toBe(0)
  })

  it('returns 0 for zero balance', () => {
    expect(calcMonthlyInterest(0, 20)).toBe(0)
  })
})

describe('calcMonthsToPayoff', () => {
  it('returns 0 for zero balance', () => {
    expect(calcMonthsToPayoff(0, 12, 100)).toBe(0)
  })

  it('returns Infinity when payment cannot cover interest', () => {
    // 12% annual on $10000 → $100/mo interest; payment of $100 never pays down
    expect(calcMonthsToPayoff(10000, 12, 100)).toBe(Infinity)
  })

  it('returns Infinity when payment is zero and balance > 0', () => {
    expect(calcMonthsToPayoff(1000, 0, 0)).toBe(Infinity)
  })

  it('computes months for zero-interest loan', () => {
    // $1000 at 0% with $100/mo = 10 months
    expect(calcMonthsToPayoff(1000, 0, 100)).toBe(10)
  })

  it('rounds up to whole months', () => {
    // $1000 at 0% with $333/mo → 1000/333 ≈ 3.003 → 4 months
    expect(calcMonthsToPayoff(1000, 0, 333)).toBe(4)
  })

  it('computes reasonable months for a typical loan', () => {
    // $10000 at 24% annual with $400/mo
    const months = calcMonthsToPayoff(10000, 24, 400)
    expect(months).toBeGreaterThan(30)
    expect(months).toBeLessThan(50)
  })
})

describe('calcTotalInterestRemaining', () => {
  it('returns 0 for zero balance', () => {
    expect(calcTotalInterestRemaining(0, 12, 100)).toBe(0)
  })

  it('returns Infinity when payment cannot cover interest', () => {
    expect(calcTotalInterestRemaining(10000, 12, 100)).toBe(Infinity)
  })

  it('returns positive interest for a typical loan', () => {
    const interest = calcTotalInterestRemaining(10000, 24, 400)
    expect(interest).toBeGreaterThan(0)
  })
})

describe('calcDebtSummary', () => {
  it('returns zero monthsToPayoff for zero balance', () => {
    const debt = makeDebt(1, 0, 12, 200)
    expect(calcDebtSummary(debt).monthsToPayoff).toBe(0)
  })

  it('calculates correct monthly interest', () => {
    const debt = makeDebt(1, 6000, 12, 300) // 1% monthly = $60
    expect(calcDebtSummary(debt).monthlyInterest).toBeCloseTo(60)
  })
})

describe('calcConsolidatedDebt', () => {
  it('returns zeros for empty list', () => {
    const result = calcConsolidatedDebt([])
    expect(result.totalBalance).toBe(0)
    expect(result.totalMinimumPayment).toBe(0)
    expect(result.totalMonthlyInterest).toBe(0)
    expect(result.items).toHaveLength(0)
  })

  it('sums balances, minimums and interest across debts', () => {
    const debts = [makeDebt(1, 5000, 12, 200), makeDebt(2, 3000, 24, 150)]
    const result = calcConsolidatedDebt(debts)
    expect(result.totalBalance).toBe(8000)
    expect(result.totalMinimumPayment).toBe(350)
    expect(result.totalMonthlyInterest).toBeCloseTo(5000 * 0.01 + 3000 * 0.02)
  })
})

describe('simulatePayoff', () => {
  it('returns zeros for empty debt list', () => {
    const result = simulatePayoff([], 500, 'snowball')
    expect(result.months).toBe(0)
    expect(result.totalInterestPaid).toBe(0)
    expect(result.payoffOrder).toHaveLength(0)
  })

  it('snowball pays off smallest balance first', () => {
    const debts = [
      makeDebt(1, 5000, 12, 150, 'Big'),
      makeDebt(2, 1000, 12, 50, 'Small'),
    ]
    const result = simulatePayoff(debts, 300, 'snowball')
    expect(result.payoffOrder[0]!.debtId).toBe(2) // Small paid first
    expect(result.payoffOrder[1]!.debtId).toBe(1)
    expect(result.months).toBeGreaterThan(0)
    expect(result.payoffOrder).toHaveLength(2)
  })

  it('avalanche pays off highest rate first', () => {
    const debts = [
      makeDebt(1, 3000, 12, 100, 'LowRate'),
      makeDebt(2, 3000, 24, 100, 'HighRate'),
    ]
    const result = simulatePayoff(debts, 300, 'avalanche')
    expect(result.payoffOrder[0]!.debtId).toBe(2) // HighRate paid first
    expect(result.payoffOrder[1]!.debtId).toBe(1)
  })

  it('avalanche pays less total interest than snowball (when rates differ)', () => {
    const debts = [
      makeDebt(1, 2000, 6, 80, 'LowRate'),
      makeDebt(2, 4000, 24, 160, 'HighRate'),
    ]
    const snowball = simulatePayoff(debts, 400, 'snowball')
    const avalanche = simulatePayoff(debts, 400, 'avalanche')
    expect(avalanche.totalInterestPaid).toBeLessThanOrEqual(snowball.totalInterestPaid)
  })

  it('single debt is paid off correctly', () => {
    // $1000 at 0% with $200/mo = 5 months, $0 interest
    const debts = [makeDebt(1, 1000, 0, 200)]
    const result = simulatePayoff(debts, 200, 'snowball')
    expect(result.months).toBe(5)
    expect(result.totalInterestPaid).toBeCloseTo(0)
    expect(result.payoffOrder[0]!.debtId).toBe(1)
  })
})
