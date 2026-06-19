import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isWithinInterval,
  getMonth,
  getYear,
  parseISO,
  getDaysInMonth,
  setDate,
} from 'date-fns'
import { es } from 'date-fns/locale'

export { startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval, parseISO }

export interface Period {
  month: number  // 1–12
  year: number
}

export function getCurrentPeriod(): Period {
  const now = new Date()
  return { month: getMonth(now) + 1, year: getYear(now) }
}

export function periodToRange(period: Period): { from: Date; to: Date } {
  const ref = new Date(period.year, period.month - 1, 1)
  return { from: startOfMonth(ref), to: endOfMonth(ref) }
}

export function formatDate(date: Date, fmt = 'd MMM yyyy'): string {
  return format(date, fmt, { locale: es })
}

export function formatShortDate(date: Date): string {
  return format(date, 'd MMM', { locale: es })
}

export function formatMonthYear(period: Period): string {
  return format(new Date(period.year, period.month - 1, 1), 'MMMM yyyy', { locale: es })
}

export function prevPeriod(period: Period): Period {
  const d = subMonths(new Date(period.year, period.month - 1, 1), 1)
  return { month: getMonth(d) + 1, year: getYear(d) }
}

export function nextPeriod(period: Period): Period {
  const d = addMonths(new Date(period.year, period.month - 1, 1), 1)
  return { month: getMonth(d) + 1, year: getYear(d) }
}

/**
 * Resolve a cut-day to an actual Date, clamping to the last day of the month
 * when the cut-day exceeds the number of days in that month (e.g. day 31 in Feb).
 */
export function resolveCutDate(cutDay: number, year: number, month: number): Date {
  const maxDay = getDaysInMonth(new Date(year, month - 1, 1))
  return setDate(new Date(year, month - 1, 1), Math.min(cutDay, maxDay))
}
