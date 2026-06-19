import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { db, creditCardsRepo } from '@/db'
import type { CreditCard } from '@/db/types'
import { useUIStore } from '@/store/uiStore'
import { getCurrentBillingCycle, type BillingCycle } from '@/domain/billing-cycle'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CardForm } from './components/CardForm'
import { CardDetail } from './components/CardDetail'

interface CardRow {
  card: CreditCard
  cycle: BillingCycle
  cycleCharges: number      // spend in current billing cycle
  debtBalance: number       // linked debt balances (occupy the limit)
  totalUsed: number
  usagePercent: number
}

function UsageBar({ percent }: { percent: number }) {
  const color =
    percent >= 100
      ? 'bg-red-500'
      : percent >= 80
        ? 'bg-orange-500'
        : percent >= 50
          ? 'bg-yellow-500'
          : 'bg-green-500'
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

export function Component() {
  const { formatAmount } = useUIStore()

  const cards = useLiveQuery(() => db.creditCards.orderBy('name').toArray(), [])
  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [])
  const allDebts = useLiveQuery(() => db.debts.toArray(), [])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CreditCard | null>(null)
  const [deleting, setDeleting] = useState<CreditCard | null>(null)
  const [viewDetail, setViewDetail] = useState<CreditCard | null>(null)

  // Compute per-card summaries and sort by urgency (fewest days to cut first)
  const rows: CardRow[] = (cards ?? [])
    .map((card) => {
      const cycle = getCurrentBillingCycle(card.cutDay, card.paymentDays)
      const charges = (allTransactions ?? []).filter(
        (tx) =>
          tx.creditCardId === card.id &&
          tx.date >= cycle.cycleStart &&
          tx.date <= cycle.cycleEnd,
      )
      const cycleCharges = charges.reduce((sum, tx) => sum + tx.amount, 0)
      const debtBalance = (allDebts ?? [])
        .filter((d) => d.creditCardId === card.id && d.currentBalance > 0)
        .reduce((sum, d) => sum + d.currentBalance, 0)
      const totalUsed = cycleCharges + debtBalance
      const usagePercent = card.creditLimit > 0 ? (totalUsed / card.creditLimit) * 100 : 0
      return { card, cycle, cycleCharges, debtBalance, totalUsed, usagePercent }
    })
    .sort((a, b) => a.cycle.daysUntilCut - b.cycle.daysUntilCut)

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(card: CreditCard) {
    setEditing(card)
    setFormOpen(true)
  }

  async function handleDelete() {
    if (deleting?.id) await creditCardsRepo.remove(deleting.id)
    setDeleting(null)
  }

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tarjetas de crédito</h1>
        <Button onClick={openNew}>+ Agregar tarjeta</Button>
      </div>

      {/* Empty state */}
      {cards && cards.length === 0 && (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <p className="text-muted-foreground text-sm">No tienes tarjetas registradas.</p>
          <Button variant="ghost" className="mt-3" onClick={openNew}>
            + Agregar primera tarjeta
          </Button>
        </div>
      )}

      {/* Card grid — sorted by urgency */}
      {rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map(({ card, cycle, cycleCharges, debtBalance, totalUsed, usagePercent }) => {
            const urgencyClass =
              cycle.daysUntilCut <= 3
                ? 'text-red-500'
                : cycle.daysUntilCut <= 7
                  ? 'text-yellow-600'
                  : 'text-muted-foreground'

            const cutLabel =
              cycle.daysUntilCut === 0
                ? 'Corte hoy'
                : cycle.daysUntilCut < 0
                  ? 'Ciclo cerrado'
                  : `${cycle.daysUntilCut}d al corte`

            return (
              <div key={card.id} className="rounded-xl border bg-card p-4 space-y-3">
                {/* Name + urgency */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-3 rounded-full shrink-0 mt-0.5"
                      style={{ background: card.color ?? '#6b7280' }}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight truncate">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Corte día {card.cutDay} · {card.paymentDays}d para pagar
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${urgencyClass}`}>
                    {cutLabel}
                  </span>
                </div>

                {/* Balance + usage bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cupo ocupado</span>
                    <span className="font-medium">{formatAmount(totalUsed)}</span>
                  </div>
                  <UsageBar percent={usagePercent} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{usagePercent.toFixed(1)}%</span>
                    <span>Límite: {formatAmount(card.creditLimit)}</span>
                  </div>
                  {/* Breakdown when there are linked debts */}
                  {debtBalance > 0 && (
                    <div className="rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] text-muted-foreground space-y-0.5">
                      <div className="flex justify-between">
                        <span>Cargos del ciclo</span>
                        <span className="tabular-nums">{formatAmount(cycleCharges)}</span>
                      </div>
                      <div className="flex justify-between text-orange-600 dark:text-orange-400">
                        <span>Deudas diferidas</span>
                        <span className="tabular-nums">{formatAmount(debtBalance)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Key dates */}
                <p className={`text-xs ${urgencyClass}`}>
                  Corte:{' '}
                  <span className="font-medium">
                    {format(cycle.cycleEnd, "d 'de' MMMM", { locale: es })}
                  </span>
                  {'  ·  '}Pago:{' '}
                  <span className="font-medium">
                    {format(cycle.paymentDeadline, "d 'de' MMMM", { locale: es })}
                  </span>
                </p>

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setViewDetail(card)}
                  >
                    Ver detalle
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(card)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleting(card)}
                    className="text-destructive hover:text-destructive"
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tarjeta' : 'Nueva tarjeta'}</DialogTitle>
          </DialogHeader>
          <CardForm
            editing={editing ?? undefined}
            onSuccess={() => {
              setFormOpen(false)
              setEditing(null)
            }}
            onCancel={() => {
              setFormOpen(false)
              setEditing(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!viewDetail} onOpenChange={(open) => !open && setViewDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewDetail && (
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{ background: viewDetail.color ?? '#6b7280' }}
                />
              )}
              {viewDetail?.name}
            </DialogTitle>
          </DialogHeader>
          {viewDetail && <CardDetail card={viewDetail} />}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarjeta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deleting?.name}". Los movimientos asociados se conservarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
