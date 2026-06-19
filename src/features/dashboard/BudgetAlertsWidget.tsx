import { useLiveQuery } from 'dexie-react-hooks'
import { db, budgetsRepo } from '@/db'
import { useUIStore } from '@/store/uiStore'
import { calcBudgetProgress } from '@/domain/budget'

export function BudgetAlertsWidget() {
  const { activePeriod, formatAmount } = useUIStore()
  const { month, year } = activePeriod

  const budgets = useLiveQuery(() => budgetsRepo.getByPeriod(year, month), [year, month])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  if (!budgets || !transactions || !categories) return null

  const catMap = new Map(categories.map((c) => [c.id!, c]))

  const alerts = budgets
    .map((b) => ({ ...calcBudgetProgress(b, transactions), category: catMap.get(b.categoryId) }))
    .filter((p) => p.status === 'near' || p.status === 'over')
    .sort((a, b) => b.percentage - a.percentage)

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Alertas de presupuesto
      </p>
      <div className="flex flex-wrap gap-2">
        {alerts.map(({ budget, spent, limit, percentage, status, category }) => {
          const isOver = status === 'over'
          const bgClass = isOver
            ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
            : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800'
          const textClass = isOver
            ? 'text-red-700 dark:text-red-400'
            : 'text-yellow-800 dark:text-yellow-400'

          return (
            <div
              key={budget.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${bgClass}`}
            >
              {category && (
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: category.color }}
                />
              )}
              <div>
                <p className={`text-xs font-medium ${textClass}`}>
                  {category?.name ?? '—'}
                  <span className="ml-1.5 font-bold">{percentage.toFixed(0)}%</span>
                </p>
                <p className={`text-[10px] ${textClass} opacity-80`}>
                  {formatAmount(spent)} de {formatAmount(limit)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
