import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { db, billSplitsRepo } from '@/db'
import type { BillSplit, BillItem } from '@/db/types'
import { useUIStore } from '@/store/uiStore'
import { splitBill } from '@/domain/bill-split'
import { Button } from '@/components/ui/button'
import { SplitWizard } from './SplitWizard'

interface CardProps {
  split: BillSplit
  items: BillItem[]
  formatAmount: (n: number) => string
  onDelete: (id: number) => void
}

function SplitCard({ split, items, formatAmount, onDelete }: CardProps) {
  const [confirming, setConfirming] = useState(false)

  const result = useMemo(
    () =>
      splitBill({
        people: split.people,
        items: items.map(({ name, unitPrice, quantity, assignedTo }) => ({
          name, unitPrice, quantity, assignedTo,
        })),
        hasIVA: split.hasIVA,
        hasServiceCharge: split.hasServiceCharge,
        serviceMode: split.serviceMode,
        serviceValue: split.serviceValue,
        splitMode: split.splitMode,
      }),
    [split, items],
  )

  const displayTitle = split.title.trim() || format(new Date(split.date), "d 'de' MMMM yyyy", { locale: es })

  return (
    <div className="rounded-lg border bg-card px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{displayTitle}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(split.date), "d MMM yyyy", { locale: es })}
            {split.people.length > 0 && ` · ${split.people.length} personas`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold tabular-nums">{formatAmount(result.grandTotal)}</p>
        </div>
      </div>

      {result.perPerson.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.perPerson.map((person) => (
            <span
              key={person.name}
              className="rounded-full bg-muted px-2.5 py-1 text-xs"
            >
              {person.name}: {formatAmount(person.total)}
            </span>
          ))}
        </div>
      )}

      {confirming ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <span className="text-xs text-muted-foreground">¿Eliminar esta división?</span>
          <Button size="sm" variant="destructive" onClick={() => onDelete(split.id!)}>
            Eliminar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  )
}

export function Component() {
  const { formatAmount } = useUIStore()
  const [showWizard, setShowWizard] = useState(false)

  const splits = useLiveQuery(() => billSplitsRepo.getAll(), [])
  const allItems = useLiveQuery(() => db.billItems.toArray(), [])

  async function handleDelete(id: number) {
    await billSplitsRepo.remove(id)
  }

  if (showWizard) {
    return (
      <div className="max-w-xl">
        <SplitWizard
          onDone={() => setShowWizard(false)}
          onCancel={() => setShowWizard(false)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Divisor de facturas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Divide cuentas grupales y calcula cuánto paga cada persona.
          </p>
        </div>
        <Button onClick={() => setShowWizard(true)} className="shrink-0">+ Nueva división</Button>
      </div>

      {!splits || !allItems ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-lg border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : splits.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm font-medium">No hay divisiones guardadas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea una nueva división para empezar a dividir facturas grupales.
          </p>
          <Button className="mt-4" onClick={() => setShowWizard(true)}>
            + Nueva división
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {splits.map((split) => (
            <SplitCard
              key={split.id}
              split={split}
              items={(allItems ?? []).filter((item) => item.billSplitId === split.id)}
              formatAmount={formatAmount}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
