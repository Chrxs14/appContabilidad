import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { useUIStore } from '@/store/uiStore'
import type { Period } from '@/lib/dates'

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function getPreviousPeriods(current: Period, count: number): Period[] {
  const periods: Period[] = []
  let { month, year } = current
  for (let i = 0; i < count; i++) {
    periods.unshift({ month, year })
    month--
    if (month === 0) { month = 12; year-- }
  }
  return periods
}

export function MonthlyChart({ months = 6 }: { months?: number }) {
  const { activePeriod, formatAmount } = useUIStore()
  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [])

  const data = useMemo(() => {
    if (!allTransactions) return []
    return getPreviousPeriods(activePeriod, months).map(({ month, year }) => {
      const periodTxs = allTransactions.filter(
        (tx) => tx.billingYear === year && tx.billingMonth === month,
      )
      const income = periodTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = periodTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
      return {
        name: `${MONTHS_ES[month - 1]} ${year !== activePeriod.year ? String(year).slice(2) : ''}`.trim(),
        Ingresos: income,
        Egresos: expense,
      }
    })
  }, [allTransactions, activePeriod, months])

  const hasData = data.some((d) => d.Ingresos > 0 || d.Egresos > 0)

  if (!hasData) return null

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Ingresos vs egresos — últimos {months} meses
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatAmount(v)}
            width={80}
          />
          <Tooltip
            formatter={(value) => [
              typeof value === 'number' ? formatAmount(value) : String(value ?? ''),
            ]}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Ingresos" fill="#22c55e" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Egresos" fill="#ef4444" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
