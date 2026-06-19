import { describe, expect, it } from 'vitest'
import { calcBudgetProgress, calcPeriodBudgets } from './budget'
import type { Budget, Transaction } from '@/db/types'

const makeBudget = (id: number, categoryId: number, limit: number, month = 6, year = 2026): Budget => ({
  id,
  categoryId,
  month,
  year,
  limitAmount: limit,
  createdAt: new Date(),
})

const makeTx = (
  id: number,
  amount: number,
  categoryId: number,
  date = new Date('2026-06-15'),
  type: 'expense' | 'income' = 'expense',
): Transaction => ({
  id,
  type,
  amount,
  date,
  categoryId,
  isRecurring: false,
  createdAt: new Date(),
})

describe('calcBudgetProgress', () => {
  it('returns zero spending when no transactions', () => {
    const b = makeBudget(1, 5, 1000)
    const result = calcBudgetProgress(b, [])
    expect(result.spent).toBe(0)
    expect(result.remaining).toBe(1000)
    expect(result.percentage).toBe(0)
    expect(result.status).toBe('ok')
  })

  it('sums only matching category and period expenses', () => {
    const b = makeBudget(1, 5, 1000)
    const txs = [
      makeTx(1, 300, 5),               // matches
      makeTx(2, 200, 5),               // matches
      makeTx(3, 500, 9),               // wrong category
      makeTx(4, 100, 5, new Date('2026-05-10')), // wrong month
    ]
    const result = calcBudgetProgress(b, txs)
    expect(result.spent).toBe(500)
    expect(result.remaining).toBe(500)
    expect(result.percentage).toBeCloseTo(50)
    expect(result.status).toBe('ok')
  })

  it('excludes income transactions', () => {
    const b = makeBudget(1, 5, 1000)
    const txs = [makeTx(1, 500, 5, new Date('2026-06-01'), 'income')]
    expect(calcBudgetProgress(b, txs).spent).toBe(0)
  })

  it('status is "near" when spending >= 90% of limit', () => {
    const b = makeBudget(1, 5, 1000)
    const txs = [makeTx(1, 900, 5)]
    expect(calcBudgetProgress(b, txs).status).toBe('near')
  })

  it('status is "over" when spending equals limit', () => {
    const b = makeBudget(1, 5, 1000)
    const txs = [makeTx(1, 1000, 5)]
    expect(calcBudgetProgress(b, txs).status).toBe('over')
  })

  it('status is "over" when spending exceeds limit', () => {
    const b = makeBudget(1, 5, 1000)
    const txs = [makeTx(1, 1500, 5)]
    const result = calcBudgetProgress(b, txs)
    expect(result.status).toBe('over')
    expect(result.remaining).toBe(-500)
    expect(result.percentage).toBeCloseTo(150)
  })

  it('respects custom nearThreshold', () => {
    const b = makeBudget(1, 5, 1000)
    const txs = [makeTx(1, 750, 5)] // 75% — ok at 0.9 threshold, near at 0.7
    expect(calcBudgetProgress(b, txs, 0.7).status).toBe('near')
    expect(calcBudgetProgress(b, txs, 0.9).status).toBe('ok')
  })

  it('handles zero limit with zero spending', () => {
    const b = makeBudget(1, 5, 0)
    expect(calcBudgetProgress(b, []).percentage).toBe(0)
    expect(calcBudgetProgress(b, []).status).toBe('ok')
  })
})

describe('calcPeriodBudgets', () => {
  it('returns correct totals', () => {
    const budgets = [makeBudget(1, 5, 1000), makeBudget(2, 6, 500)]
    const txs = [makeTx(1, 400, 5), makeTx(2, 300, 6)]
    const result = calcPeriodBudgets(budgets, txs)
    expect(result.totalLimit).toBe(1500)
    expect(result.totalSpent).toBe(700)
    expect(result.totalRemaining).toBe(800)
  })

  it('sorts: over before near before ok', () => {
    const budgets = [
      makeBudget(1, 1, 1000), // ok
      makeBudget(2, 2, 1000), // near (900)
      makeBudget(3, 3, 1000), // over (1100)
    ]
    const txs = [
      makeTx(1, 200, 1),
      makeTx(2, 900, 2),
      makeTx(3, 1100, 3),
    ]
    const { items } = calcPeriodBudgets(budgets, txs)
    expect(items[0]!.status).toBe('over')
    expect(items[1]!.status).toBe('near')
    expect(items[2]!.status).toBe('ok')
  })

  it('returns empty items for empty budgets list', () => {
    const result = calcPeriodBudgets([], [])
    expect(result.items).toHaveLength(0)
    expect(result.totalLimit).toBe(0)
  })
})
