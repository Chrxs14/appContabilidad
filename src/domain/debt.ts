import type { Debt } from '@/db/types'

export interface DebtSummary {
  debt: Debt
  monthlyInterest: number   // interest accrued this month at current balance
  monthsToPayoff: number    // Infinity if payment <= monthly interest
  totalInterestRemaining: number
}

export interface ConsolidatedDebt {
  totalBalance: number
  totalMinimumPayment: number
  totalMonthlyInterest: number
  items: DebtSummary[]
}

export interface PayoffResult {
  months: number
  totalInterestPaid: number
  payoffOrder: { debtId: number; name: string; monthPaidOff: number }[]
}

/** Monthly interest amount for a given balance and annual rate (%). */
export function calcMonthlyInterest(balance: number, annualRate: number): number {
  return balance * (annualRate / 100 / 12)
}

/**
 * Months to pay off a balance with a fixed monthly payment.
 * Returns Infinity when the payment cannot cover the interest.
 */
export function calcMonthsToPayoff(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
): number {
  if (balance <= 0) return 0
  const r = annualRate / 100 / 12
  if (r === 0) {
    return monthlyPayment > 0 ? Math.ceil(balance / monthlyPayment) : Infinity
  }
  const interest = balance * r
  if (monthlyPayment <= interest) return Infinity
  return Math.ceil(-Math.log(1 - (balance * r) / monthlyPayment) / Math.log(1 + r))
}

/** Total interest paid over the life of the debt at fixed monthly payment. */
export function calcTotalInterestRemaining(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
): number {
  const months = calcMonthsToPayoff(balance, annualRate, monthlyPayment)
  if (!isFinite(months)) return Infinity
  return Math.max(0, months * monthlyPayment - balance)
}

/** Summary for a single debt. */
export function calcDebtSummary(debt: Debt): DebtSummary {
  const monthlyInterest = calcMonthlyInterest(debt.currentBalance, debt.annualRate)
  const monthsToPayoff = calcMonthsToPayoff(
    debt.currentBalance,
    debt.annualRate,
    debt.minimumPayment,
  )
  const totalInterestRemaining = calcTotalInterestRemaining(
    debt.currentBalance,
    debt.annualRate,
    debt.minimumPayment,
  )
  return { debt, monthlyInterest, monthsToPayoff, totalInterestRemaining }
}

/** Consolidated totals across all debts. */
export function calcConsolidatedDebt(debts: Debt[]): ConsolidatedDebt {
  const items = debts.map(calcDebtSummary)
  return {
    totalBalance: debts.reduce((s, d) => s + d.currentBalance, 0),
    totalMinimumPayment: debts.reduce((s, d) => s + d.minimumPayment, 0),
    totalMonthlyInterest: items.reduce((s, i) => s + i.monthlyInterest, 0),
    items,
  }
}

/**
 * Simulate debt payoff using either snowball (lowest balance first)
 * or avalanche (highest rate first) strategy.
 *
 * @param debts         List of debts with current balances, rates, and minimum payments.
 * @param monthlyBudget Total amount available per month for debt payments.
 * @param strategy      'snowball' | 'avalanche'
 * @param maxMonths     Safety cap to prevent infinite loops. Default 600 (50 years).
 */
export function simulatePayoff(
  debts: Debt[],
  monthlyBudget: number,
  strategy: 'snowball' | 'avalanche',
  maxMonths = 600,
): PayoffResult {
  if (debts.length === 0) return { months: 0, totalInterestPaid: 0, payoffOrder: [] }

  // Work with mutable copies
  const balances = debts.map((d) => d.currentBalance)
  const rates = debts.map((d) => d.annualRate / 100 / 12)
  const minimums = debts.map((d) => d.minimumPayment)
  const active = debts.map(() => true)

  const payoffOrder: { debtId: number; name: string; monthPaidOff: number }[] = []
  let totalInterestPaid = 0
  let month = 0

  while (active.some(Boolean) && month < maxMonths) {
    month++

    // 1. Accrue interest on all active debts
    for (let i = 0; i < balances.length; i++) {
      if (!active[i]) continue
      const interest = balances[i]! * rates[i]!
      totalInterestPaid += interest
      balances[i] = balances[i]! + interest
    }

    // 2. Apply minimum payments on all active debts
    let remaining = monthlyBudget
    for (let i = 0; i < balances.length; i++) {
      if (!active[i]) continue
      const payment = Math.min(minimums[i]!, balances[i]!)
      balances[i] = balances[i]! - payment
      remaining -= payment
    }

    // 3. Pick target debt and apply extra
    if (remaining > 0) {
      const activeIndices = active
        .map((a, i) => (a ? i : -1))
        .filter((i) => i !== -1)

      const target =
        strategy === 'snowball'
          ? activeIndices.reduce((best, i) => (balances[i]! < balances[best]! ? i : best))
          : activeIndices.reduce((best, i) =>
              rates[i]! > rates[best]! ? i : i === best ? best : rates[i]! === rates[best]! ? (balances[i]! > balances[best]! ? i : best) : best,
            )

      balances[target] = Math.max(0, balances[target]! - remaining)
    }

    // 4. Mark paid-off debts
    for (let i = 0; i < balances.length; i++) {
      if (active[i] && balances[i]! <= 0.005) {
        active[i] = false
        balances[i] = 0
        payoffOrder.push({ debtId: debts[i]!.id!, name: debts[i]!.name, monthPaidOff: month })
      }
    }
  }

  return { months: month, totalInterestPaid, payoffOrder }
}
