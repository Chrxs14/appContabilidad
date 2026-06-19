import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { useUIStore } from '@/store/uiStore'
import { periodToRange } from '@/lib/dates'
import { calcExpenseByCategory } from '@/domain/summaries'

export function SpendingDonut() {
  const { activePeriod, formatAmount } = useUIStore()
  const { from, to } = periodToRange(activePeriod)

  const transactions = useLiveQuery(
    () => db.transactions.where('date').between(from, to, true, true).toArray(),
    [from.getTime(), to.getTime()],
  )
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  const data = useMemo(() => {
    if (!transactions || !categories) return []
    const catMap = new Map(categories.map((c) => [c.id!, c]))
    const byCategory = calcExpenseByCategory(transactions)
    return [...byCategory.entries()]
      .map(([catId, amount]) => ({
        name: catMap.get(catId)?.name ?? 'Sin categoría',
        value: amount,
        color: catMap.get(catId)?.color ?? '#9ca3af',
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8) // top 8 categories to keep chart readable
  }, [transactions, categories])

  if (!data.length) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed">
        <p className="text-xs text-muted-foreground">Sin egresos en este periodo</p>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [
            typeof value === 'number' ? formatAmount(value) : String(value ?? ''),
          ]}
          contentStyle={{ fontSize: 11 }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, lineHeight: '1.6' }}
          formatter={(value: string) =>
            value.length > 14 ? value.slice(0, 13) + '…' : value
          }
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
