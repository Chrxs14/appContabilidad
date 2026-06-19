import type { Account, Transaction } from '@/db/types'

export interface AccountBalance {
  account: Account
  balance: number          // initialBalance + income - expense
  totalIncome: number
  totalExpense: number
}

export interface PeriodSummary {
  totalIncome: number
  totalExpense: number
  netFlow: number          // income - expense
}

export interface AccountDistribution {
  accountId: number
  name: string
  balance: number
  percentage: number       // share of total positive balance
}

/**
 * Calculate running balance for a single account given its transactions.
 * Transactions must already be filtered to the desired period (or all time).
 */
export function calcAccountBalance(
  account: Account,
  transactions: Transaction[],
): AccountBalance {
  let totalIncome = 0
  let totalExpense = 0

  for (const tx of transactions) {
    if (tx.accountId !== account.id) continue
    if (tx.type === 'income') totalIncome += tx.amount
    else totalExpense += tx.amount
  }

  return {
    account,
    balance: (account.initialBalance ?? 0) + totalIncome - totalExpense,
    totalIncome,
    totalExpense,
  }
}

/**
 * Calculate balances for all accounts and the distribution (% share).
 * Only accounts with positive balance are included in the percentage calculation.
 */
export function calcAccountDistribution(
  accounts: Account[],
  transactions: Transaction[],
): AccountDistribution[] {
  const balances = accounts.map((a) => calcAccountBalance(a, transactions))
  const positiveTotal = balances.reduce((sum, b) => sum + Math.max(0, b.balance), 0)

  return balances.map(({ account, balance }) => ({
    accountId: account.id!,
    name: account.name,
    balance,
    percentage: positiveTotal > 0 ? (Math.max(0, balance) / positiveTotal) * 100 : 0,
  }))
}

/**
 * Summarise income / expense / net for a list of transactions (any scope).
 */
export function calcPeriodSummary(transactions: Transaction[]): PeriodSummary {
  let totalIncome = 0
  let totalExpense = 0

  for (const tx of transactions) {
    if (tx.type === 'income') totalIncome += tx.amount
    else totalExpense += tx.amount
  }

  return { totalIncome, totalExpense, netFlow: totalIncome - totalExpense }
}

/**
 * Group transactions by category and sum their amounts (expense only by default).
 */
export function calcExpenseByCategory(
  transactions: Transaction[],
): Map<number, number> {
  const map = new Map<number, number>()
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount)
  }
  return map
}
