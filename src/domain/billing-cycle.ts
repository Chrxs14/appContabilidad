export interface BillingCycle {
  cycleStart: Date
  cycleEnd: Date
  paymentDeadline: Date
  daysUntilCut: number
  daysUntilPayment: number
}

/** Clamp a day to the last day of the given month (handles negative/overflow months). */
function clampToMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

/**
 * Given a card's cut day and payment days, return the current open billing cycle.
 *
 * Rules:
 * - If today <= cutDay of this month → cycle closes this month on cutDay.
 * - If today > cutDay of this month → cycle closes next month on cutDay.
 * - cutDay is clamped to the last valid day of the target month (handles cutDay 31 in Feb, etc.).
 */
export function getCurrentBillingCycle(
  cutDay: number,
  paymentDays: number,
  referenceDate: Date = new Date(),
): BillingCycle {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const day = referenceDate.getDate()

  const cutThisMonth = clampToMonth(year, month, cutDay)

  let cycleEnd: Date
  let cycleStart: Date

  if (day <= cutThisMonth.getDate()) {
    // Cycle closes this month
    cycleEnd = cutThisMonth
    const prevCut = clampToMonth(year, month - 1, cutDay)
    cycleStart = new Date(prevCut.getFullYear(), prevCut.getMonth(), prevCut.getDate() + 1)
  } else {
    // Cycle closes next month
    cycleEnd = clampToMonth(year, month + 1, cutDay)
    cycleStart = new Date(
      cutThisMonth.getFullYear(),
      cutThisMonth.getMonth(),
      cutThisMonth.getDate() + 1,
    )
  }

  // Payment deadline = cut date + paymentDays (JS Date handles month overflow)
  const paymentDeadline = new Date(
    cycleEnd.getFullYear(),
    cycleEnd.getMonth(),
    cycleEnd.getDate() + paymentDays,
  )

  const today = new Date(year, month, day)
  const msPerDay = 24 * 60 * 60 * 1000
  const daysUntilCut = Math.round((cycleEnd.getTime() - today.getTime()) / msPerDay)
  const daysUntilPayment = Math.round((paymentDeadline.getTime() - today.getTime()) / msPerDay)

  return { cycleStart, cycleEnd, paymentDeadline, daysUntilCut, daysUntilPayment }
}

/**
 * Given a transaction date and a card's cut day, return the billing period
 * (year + 1-indexed month) the transaction belongs to.
 *
 * Rule: if the transaction day is on or before the cut day of that calendar
 * month, it belongs to that month's billing cycle. If it's after the cut day
 * it belongs to the NEXT month's cycle (the card statement that closes next month).
 */
export function getBillingPeriod(
  txDate: Date,
  cutDay: number,
): { billingYear: number; billingMonth: number } {
  const year = txDate.getFullYear()
  const month = txDate.getMonth() // 0-11
  const day = txDate.getDate()

  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  const effectiveCutDay = Math.min(cutDay, lastDayOfMonth)

  if (day <= effectiveCutDay) {
    return { billingYear: year, billingMonth: month + 1 }
  }
  const next = new Date(year, month + 1, 1)
  return { billingYear: next.getFullYear(), billingMonth: next.getMonth() + 1 }
}
