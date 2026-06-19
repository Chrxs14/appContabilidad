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
import { calcPeriodBudgets } from '@/domain/budget'
import type { Period } from '@/lib/dates'

const MONTHS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

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

interface Props {
  months?: number
}

export function BudgetChart({ months = 6 }: Props) {
  const { activePeriod, formatAmount } = useUIStore()

  const allBudgets = useLiveQuery(() => db.budgets.toArray(), [])
  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [])

  const chartData = useMemo(() => {
    if (!allBudgets || !allTransactions) return []

    return getPreviousPeriods(activePeriod, months).map(({ month, year }) => {
      const periodBudgets = allBudgets.filter((b) => b.month === month && b.year === year)
      const summary = calcPeriodBudgets(periodBudgets, allTransactions)

      return {
        name: `${MONTHS_ES[month - 1]} ${year !== activePeriod.year ? year : ''}`.trim(),
        Presupuestado: summary.totalLimit,
        Gastado: summary.totalSpent,
      }
    })
  }, [allBudgets, allTransactions, activePeriod, months])

  if (!chartData.length || chartData.every((d) => d.Presupuestado === 0 && d.Gastado === 0)) {
    return null
  }

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Últimos {months} meses
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barGap={4} barCategoryGap="30%">
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
          <Bar dataKey="Presupuestado" fill="hsl(var(--primary) / 0.4)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Gastado" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
