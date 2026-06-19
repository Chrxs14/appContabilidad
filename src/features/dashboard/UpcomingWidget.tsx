import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { db } from '@/db'
import { useUIStore } from '@/store/uiStore'
import { getCurrentBillingCycle } from '@/domain/billing-cycle'
import { calcConsolidatedDebt } from '@/domain/debt'

interface UpcomingItem {
  key: string
  label: string
  sub: string
  daysUntil: number
  amount?: number
  amountLabel?: string
  color?: string
}

export function UpcomingWidget() {
  const { formatAmount } = useUIStore()
  const cards = useLiveQuery(() => db.creditCards.orderBy('name').toArray(), [])
  const debts = useLiveQuery(() => db.debts.orderBy('name').toArray(), [])

  const items: UpcomingItem[] = useMemo(() => {
    const result: UpcomingItem[] = []

    // Card cut + payment deadlines
    for (const card of cards ?? []) {
      const cycle = getCurrentBillingCycle(card.cutDay, card.paymentDays)
      if (cycle.daysUntilCut >= 0 && cycle.daysUntilCut <= 30) {
        result.push({
          key: `cut-${card.id}`,
          label: card.name,
          sub: cycle.daysUntilCut === 0
            ? 'Corte hoy'
            : `Corte en ${cycle.daysUntilCut}d · ${format(cycle.cycleEnd, "d MMM", { locale: es })}`,
          daysUntil: cycle.daysUntilCut,
          color: card.color,
        })
      }
      if (cycle.daysUntilPayment >= 0 && cycle.daysUntilPayment <= 30) {
        result.push({
          key: `pay-${card.id}`,
          label: `Pago ${card.name}`,
          sub: cycle.daysUntilPayment === 0
            ? 'Pago vence hoy'
            : `Pago en ${cycle.daysUntilPayment}d · ${format(cycle.paymentDeadline, "d MMM", { locale: es })}`,
          daysUntil: cycle.daysUntilPayment,
          color: card.color,
        })
      }
    }

    // Debts: show as "monthly minimum" (no fixed due date)
    const consolidated = calcConsolidatedDebt(debts ?? [])
    if (consolidated.totalBalance > 0) {
      result.push({
        key: 'debts-total',
        label: 'Deudas — mínimo mensual',
        sub: `${(debts ?? []).length} deuda${(debts ?? []).length !== 1 ? 's' : ''} · saldo ${formatAmount(consolidated.totalBalance)}`,
        daysUntil: 31,
        amount: consolidated.totalMinimumPayment,
        amountLabel: 'mín/mes',
      })
    }

    return result.sort((a, b) => a.daysUntil - b.daysUntil)
  }, [cards, debts, formatAmount])

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center">
        <p className="text-xs text-muted-foreground">Sin vencimientos próximos</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border rounded-lg border">
      {items.map((item) => {
        const urgency =
          item.daysUntil <= 3
            ? 'text-red-500'
            : item.daysUntil <= 7
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-muted-foreground'

        return (
          <div key={item.key} className="flex items-center gap-3 px-3 py-2.5">
            {item.color ? (
              <span className="size-2 shrink-0 rounded-full" style={{ background: item.color }} />
            ) : (
              <span className="size-2 shrink-0 rounded-full bg-primary/40" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.label}</p>
              <p className={`text-[11px] ${urgency}`}>{item.sub}</p>
            </div>
            {item.amount !== undefined && (
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold tabular-nums">{formatAmount(item.amount)}</p>
                {item.amountLabel && (
                  <p className="text-[10px] text-muted-foreground">{item.amountLabel}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
