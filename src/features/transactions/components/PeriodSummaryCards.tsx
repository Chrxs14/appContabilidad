import { calcPeriodSummary } from '@/domain/summaries'
import { useUIStore } from '@/store/uiStore'
import { usePeriodTransactions } from '../hooks/useTransactions'

export function PeriodSummaryCards() {
  const { formatAmount } = useUIStore()
  const transactions = usePeriodTransactions()

  if (!transactions) return null

  const { totalIncome, totalExpense, netFlow } = calcPeriodSummary(transactions)

  const cards = [
    {
      label: 'Ingresos',
      value: totalIncome,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      label: 'Egresos',
      value: totalExpense,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
    {
      label: 'Flujo neto',
      value: netFlow,
      color: netFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500',
      bg: 'bg-muted/50',
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(({ label, value, color, bg }) => (
        <div key={label} className={`rounded-lg p-4 ${bg}`}>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {label}
          </p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>
            {value >= 0 ? '' : '-'}
            {formatAmount(Math.abs(value))}
          </p>
        </div>
      ))}
    </div>
  )
}
