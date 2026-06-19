import { describe, expect, it } from 'vitest'
import {
  calcAccountBalance,
  calcAccountDistribution,
  calcPeriodSummary,
  calcExpenseByCategory,
} from './summaries'
import type { Account, Transaction } from '@/db/types'

const makeAccount = (id: number, initialBalance = 0): Account => ({
  id,
  name: `Account ${id}`,
  type: 'bank',
  initialBalance,
  isDefault: false,
  createdAt: new Date(),
})

const makeTx = (
  id: number,
  type: 'income' | 'expense',
  amount: number,
  accountId: number,
  categoryId = 1,
): Transaction => {
  const date = new Date()
  return {
    id,
    type,
    amount,
    date,
    categoryId,
    accountId,
    billingYear: date.getFullYear(),
    billingMonth: date.getMonth() + 1,
    isRecurring: false,
    createdAt: new Date(),
  }
}

describe('calcAccountBalance', () => {
  it('returns initialBalance when no transactions', () => {
    const acc = makeAccount(1, 500)
    expect(calcAccountBalance(acc, []).balance).toBe(500)
  })

  it('adds income and subtracts expense', () => {
    const acc = makeAccount(1, 1000)
    const txs = [makeTx(1, 'income', 500, 1), makeTx(2, 'expense', 200, 1)]
    const result = calcAccountBalance(acc, txs)
    expect(result.balance).toBe(1300)
    expect(result.totalIncome).toBe(500)
    expect(result.totalExpense).toBe(200)
  })

  it('ignores transactions from other accounts', () => {
    const acc = makeAccount(1, 0)
    const txs = [makeTx(1, 'income', 999, 2)]  // account 2
    expect(calcAccountBalance(acc, txs).balance).toBe(0)
  })

  it('handles zero initial balance with only expenses', () => {
    const acc = makeAccount(1, 0)
    const txs = [makeTx(1, 'expense', 300, 1)]
    expect(calcAccountBalance(acc, txs).balance).toBe(-300)
  })
})

describe('calcAccountDistribution', () => {
  it('computes percentage share across accounts', () => {
    const accounts = [makeAccount(1, 0), makeAccount(2, 0)]
    const txs = [makeTx(1, 'income', 600, 1), makeTx(2, 'income', 400, 2)]
    const dist = calcAccountDistribution(accounts, txs)
    const a1 = dist.find((d) => d.accountId === 1)!
    const a2 = dist.find((d) => d.accountId === 2)!
    expect(a1.percentage).toBeCloseTo(60)
    expect(a2.percentage).toBeCloseTo(40)
  })

  it('returns 0% for all when total is 0', () => {
    const accounts = [makeAccount(1, 0)]
    const dist = calcAccountDistribution(accounts, [])
    expect(dist[0]!.percentage).toBe(0)
  })
})

describe('calcPeriodSummary', () => {
  it('returns zeros for empty transaction list', () => {
    const summary = calcPeriodSummary([])
    expect(summary).toEqual({ totalIncome: 0, totalExpense: 0, netFlow: 0 })
  })

  it('calculates net flow correctly', () => {
    const txs = [makeTx(1, 'income', 3000, 1), makeTx(2, 'expense', 1200, 1)]
    const { totalIncome, totalExpense, netFlow } = calcPeriodSummary(txs)
    expect(totalIncome).toBe(3000)
    expect(totalExpense).toBe(1200)
    expect(netFlow).toBe(1800)
  })

  it('reports negative net flow when expenses exceed income', () => {
    const txs = [makeTx(1, 'income', 500, 1), makeTx(2, 'expense', 800, 1)]
    expect(calcPeriodSummary(txs).netFlow).toBe(-300)
  })
})

describe('calcExpenseByCategory', () => {
  it('groups expenses by categoryId', () => {
    const txs = [
      makeTx(1, 'expense', 100, 1, 5),
      makeTx(2, 'expense', 200, 1, 5),
      makeTx(3, 'expense', 50, 1, 8),
    ]
    const map = calcExpenseByCategory(txs)
    expect(map.get(5)).toBe(300)
    expect(map.get(8)).toBe(50)
  })

  it('excludes income transactions', () => {
    const txs = [makeTx(1, 'income', 999, 1, 3)]
    expect(calcExpenseByCategory(txs).size).toBe(0)
  })

  it('returns empty map for empty input', () => {
    expect(calcExpenseByCategory([]).size).toBe(0)
  })

  it('handles mixed income and expense for same category', () => {
    const txs = [
      makeTx(1, 'expense', 500, 1, 2),
      makeTx(2, 'income', 999, 1, 2), // income in same category should not be counted
    ]
    expect(calcExpenseByCategory(txs).get(2)).toBe(500)
  })
})

describe('calcAccountBalance — edge cases', () => {
  it('defaults initialBalance to 0 when undefined', () => {
    const acc = { ...makeAccount(1), initialBalance: undefined as unknown as number }
    expect(calcAccountBalance(acc, []).balance).toBe(0)
  })
})

describe('calcPeriodSummary — all income', () => {
  it('handles all-income list correctly', () => {
    const txs = [makeTx(1, 'income', 1000, 1), makeTx(2, 'income', 500, 1)]
    const { totalIncome, totalExpense, netFlow } = calcPeriodSummary(txs)
    expect(totalIncome).toBe(1500)
    expect(totalExpense).toBe(0)
    expect(netFlow).toBe(1500)
  })
})
