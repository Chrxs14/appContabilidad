import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { db } from '@/db'
import type { CreditCard } from '@/db/types'
import { useUIStore } from '@/store/uiStore'
import { getCurrentBillingCycle } from '@/domain/billing-cycle'

interface Props {
  card: CreditCard
}

function InfoBox({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
      <p className={`font-medium text-sm ${valueClass ?? ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export function CardDetail({ card }: Props) {
  const { formatAmount } = useUIStore()
  const cycle = getCurrentBillingCycle(card.cutDay, card.paymentDays)

  const charges = useLiveQuery(
    () =>
      db.transactions
        .where('creditCardId')
        .equals(card.id!)
        .and((tx) => tx.date >= cycle.cycleStart && tx.date <= cycle.cycleEnd)
        .toArray()
        .then((txs) => txs.sort((a, b) => b.date.getTime() - a.date.getTime())),
    [card.id, cycle.cycleStart.getTime(), cycle.cycleEnd.getTime()],
  )

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const categoryMap = new Map(categories?.map((c) => [c.id!, c]) ?? [])

  const totalCharges = charges?.reduce((sum, tx) => sum + tx.amount, 0) ?? 0
  const usagePercent = card.creditLimit > 0 ? (totalCharges / card.creditLimit) * 100 : 0
  const available = card.creditLimit - totalCharges

  const barColor =
    usagePercent >= 100
      ? 'bg-red-500'
      : usagePercent >= 80
        ? 'bg-orange-500'
        : usagePercent >= 50
          ? 'bg-yellow-500'
          : 'bg-green-500'

  const cutUrgency =
    cycle.daysUntilCut <= 3
      ? 'text-red-500'
      : cycle.daysUntilCut <= 7
        ? 'text-yellow-600'
        : ''

  const cutSub =
    cycle.daysUntilCut === 0
      ? 'Hoy'
      : cycle.daysUntilCut < 0
        ? 'Ciclo cerrado'
        : `${cycle.daysUntilCut} días restantes`

  const paymentSub =
    cycle.daysUntilPayment === 0
      ? 'Hoy'
      : cycle.daysUntilPayment < 0
        ? 'Vencido'
        : `${cycle.daysUntilPayment} días restantes`

  return (
    <div className="space-y-5">
      {/* Usage bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Saldo estimado del ciclo</span>
          <span className="font-semibold">
            {formatAmount(totalCharges)} / {formatAmount(card.creditLimit)}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{usagePercent.toFixed(1)}% utilizado</span>
          <span>Disponible: {formatAmount(Math.max(0, available))}</span>
        </div>

        {/* Limit alerts */}
        {usagePercent >= 100 && (
          <div className="rounded-md bg-red-100 dark:bg-red-950 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            Límite de crédito agotado
          </div>
        )}
        {usagePercent >= 80 && usagePercent < 100 && (
          <div className="rounded-md bg-orange-100 dark:bg-orange-950 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
            Uso por encima del 80% del límite
          </div>
        )}
        {usagePercent >= 50 && usagePercent < 80 && (
          <div className="rounded-md bg-yellow-100 dark:bg-yellow-950 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
            Uso por encima del 50% del límite
          </div>
        )}
      </div>

      {/* Cycle info grid */}
      <div className="grid grid-cols-2 gap-3">
        <InfoBox
          label="Inicio del ciclo"
          value={format(cycle.cycleStart, "d 'de' MMMM", { locale: es })}
        />
        <InfoBox
          label="Fecha de corte"
          value={format(cycle.cycleEnd, "d 'de' MMMM", { locale: es })}
          sub={cutSub}
          valueClass={cutUrgency}
        />
        <InfoBox
          label="Fecha límite de pago"
          value={format(cycle.paymentDeadline, "d 'de' MMMM", { locale: es })}
          sub={paymentSub}
        />
        <InfoBox
          label="Tasa de interés anual"
          value={`${card.annualRate.toFixed(2)}%`}
        />
      </div>

      {/* Charges list */}
      <div>
        <p className="text-sm font-semibold mb-2">
          Cargos del ciclo actual
          {charges && charges.length > 0 && (
            <span className="ml-1.5 text-muted-foreground font-normal">({charges.length})</span>
          )}
        </p>

        {!charges && <p className="text-muted-foreground text-sm">Cargando…</p>}

        {charges?.length === 0 && (
          <p className="text-muted-foreground text-sm py-4 text-center">
            Sin cargos en este ciclo
          </p>
        )}

        {charges && charges.length > 0 && (
          <div className="divide-y divide-border rounded-lg border">
            {charges.map((tx) => {
              const cat = categoryMap.get(tx.categoryId)
              return (
                <div key={tx.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: cat?.color ?? '#9ca3af' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{cat?.name ?? 'Sin categoría'}</p>
                    {tx.note && (
                      <p className="text-xs text-muted-foreground truncate">{tx.note}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-red-500">-{formatAmount(tx.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(tx.date, 'd MMM', { locale: es })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
