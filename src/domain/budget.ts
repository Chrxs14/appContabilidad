import type { Budget, Transaction } from '@/db/types'

export type BudgetStatus = 'ok' | 'near' | 'over'

export interface BudgetProgress {
  budget: Budget
  spent: number
  limit: number
  remaining: number
  percentage: number   // 0–100+ (can exceed 100 when over budget)
  status: BudgetStatus
}

export interface PeriodBudgetSummary {
  totalLimit: number
  totalSpent: number
  totalRemaining: number
  items: BudgetProgress[]
}

/**
 * Calculate spending progress for a single budget given the expense transactions
 * for that same period and category.
 * @param nearThreshold  0–1, fraction of limit considered "near". Default 0.9.
 */
export function calcBudgetProgress(
  budget: Budget,
  transactions: Transaction[],
  nearThreshold = 0.9,
): BudgetProgress {
  const spent = transactions
    .filter(
      (tx) =>
        tx.type === 'expense' &&
        tx.categoryId === budget.categoryId &&
        tx.billingYear === budget.year &&
        tx.billingMonth === budget.month,
    )
    .reduce((sum, tx) => sum + tx.amount, 0)

  const limit = budget.limitAmount
  const remaining = limit - spent
  const percentage = limit > 0 ? (spent / limit) * 100 : spent > 0 ? Infinity : 0

  let status: BudgetStatus
  if (limit > 0 ? spent >= limit : spent > 0) {
    status = 'over'
  } else if (percentage >= nearThreshold * 100) {
    status = 'near'
  } else {
    status = 'ok'
  }

  return { budget, spent, limit, remaining, percentage, status }
}

/**
 * Calculate progress for every budget in a period, sorted by urgency
 * (over → near → ok, then by percentage desc within each group).
 */
export function calcPeriodBudgets(
  budgets: Budget[],
  transactions: Transaction[],
  nearThreshold = 0.9,
): PeriodBudgetSummary {
  const items = budgets
    .map((b) => calcBudgetProgress(b, transactions, nearThreshold))
    .sort((a, b) => {
      const order: Record<BudgetStatus, number> = { over: 0, near: 1, ok: 2 }
      const byStatus = order[a.status] - order[b.status]
      return byStatus !== 0 ? byStatus : b.percentage - a.percentage
    })

  const totalLimit = items.reduce((s, i) => s + i.limit, 0)
  const totalSpent = items.reduce((s, i) => s + i.spent, 0)

  return {
    totalLimit,
    totalSpent,
    totalRemaining: totalLimit - totalSpent,
    items,
  }
}
