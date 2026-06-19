import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { useUIStore } from '@/store/uiStore'
import { formatMonthYear, periodToRange } from '@/lib/dates'
import { calcPeriodSummary } from '@/domain/summaries'
import { calcConsolidatedDebt } from '@/domain/debt'
import { PeriodSelector } from '@/features/transactions/components/PeriodSelector'
import { AccountsPanel } from '@/features/transactions/components/AccountsPanel'
import { UpcomingWidget } from './UpcomingWidget'
import { BudgetAlertsWidget } from './BudgetAlertsWidget'
import { SpendingDonut } from './SpendingDonut'
import { MonthlyChart } from './MonthlyChart'

function MetricCard({
  label,
  value,
  color = 'text-foreground',
  bg = 'bg-card',
}: {
  label: string
  value: string
  color?: string
  bg?: string
}) {
  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

export function Component() {
  const { activePeriod, formatAmount } = useUIStore()
  const { from, to } = periodToRange(activePeriod)

  const periodTxs = useLiveQuery(
    () => db.transactions.where('date').between(from, to, true, true).toArray(),
    [from.getTime(), to.getTime()],
  )
  const debts = useLiveQuery(() => db.debts.toArray(), [])

  const summary = periodTxs ? calcPeriodSummary(periodTxs) : null
  const consolidated = debts ? calcConsolidatedDebt(debts) : null

  const isEmpty = (periodTxs?.length ?? 0) === 0 && (debts?.length ?? 0) === 0

  return (
    <div className="max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">
            {formatMonthYear(activePeriod)}
          </p>
        </div>
      </div>

      <PeriodSelector />

      {/* Getting started — shown only when there's no data at all */}
      {isEmpty && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <p className="text-sm font-medium">¡Bienvenido! Tu app de finanzas está lista.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ve a <strong>Transacciones</strong> para registrar tu primer movimiento, o a{' '}
            <strong>Ajustes</strong> para importar un respaldo existente.
          </p>
        </div>
      )}

      {/* Key metrics row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Ingresos"
          value={formatAmount(summary?.totalIncome ?? 0)}
          color="text-green-600 dark:text-green-400"
          bg="bg-green-50 dark:bg-green-950/20"
        />
        <MetricCard
          label="Egresos"
          value={formatAmount(summary?.totalExpense ?? 0)}
          color="text-red-500"
          bg="bg-red-50 dark:bg-red-950/20"
        />
        <MetricCard
          label="Flujo neto"
          value={
            (summary?.netFlow ?? 0) < 0
              ? `-${formatAmount(Math.abs(summary?.netFlow ?? 0))}`
              : formatAmount(summary?.netFlow ?? 0)
          }
          color={
            (summary?.netFlow ?? 0) >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-500'
          }
        />
        <MetricCard
          label="Deuda total"
          value={formatAmount(consolidated?.totalBalance ?? 0)}
          color={
            (consolidated?.totalBalance ?? 0) > 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'
          }
        />
      </div>

      {/* Main content: donut + upcoming */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Spending donut */}
        <div className="space-y-2 lg:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Egresos por categoría
          </p>
          <div className="rounded-lg border p-4">
            <SpendingDonut />
          </div>
        </div>

        {/* Upcoming deadlines */}
        <div className="space-y-2 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Próximos vencimientos
          </p>
          <UpcomingWidget />
        </div>
      </div>

      {/* Monthly chart */}
      <MonthlyChart />

      {/* Budget alerts */}
      <BudgetAlertsWidget />

      {/* Accounts distribution */}
      <AccountsPanel />
    </div>
  )
}
