import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, debtsRepo, debtPaymentsRepo } from '@/db'
import type { Debt, DebtPayment } from '@/db/types'
import { useUIStore } from '@/store/uiStore'
import { calcConsolidatedDebt } from '@/domain/debt'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PayoffSimulator } from './PayoffSimulator'

// ─── Constants ─────────────────────────────────────────────────────────────────

const TERM_OPTIONS = [
  { value: '0',  label: 'Sin plazo fijo' },
  { value: '3',  label: '3 cuotas' },
  { value: '6',  label: '6 cuotas' },
  { value: '9',  label: '9 cuotas' },
  { value: '12', label: '12 cuotas' },
  { value: '18', label: '18 cuotas' },
  { value: '24', label: '24 cuotas' },
  { value: '30', label: '30 cuotas' },
  { value: '36', label: '36 cuotas' },
]

// ─── Schemas ───────────────────────────────────────────────────────────────────

const debtSchema = z
  .object({
    name: z.string().min(1, 'La descripción es requerida'),
    origin: z.string().min(1, 'Selecciona el origen'),
    lenderName: z.string().optional(),
    currentBalance: z.number().nonnegative({ message: 'El saldo no puede ser negativo' }),
    annualRate: z.number().nonnegative({ message: 'La tasa no puede ser negativa' }),
    installmentAmount: z.number().positive({ message: 'La cuota debe ser mayor a 0' }),
    termMonths: z.number().min(0),
  })
  .refine(
    (d) => d.origin !== 'other' || (d.lenderName?.trim() ?? '').length > 0,
    { message: 'Ingresa el nombre de la entidad', path: ['lenderName'] },
  )

const paymentSchema = z.object({
  amount: z.number().positive({ message: 'El monto debe ser mayor a 0' }),
  date: z.string().min(1, 'La fecha es requerida'),
  note: z.string().optional(),
})

type DebtValues = z.infer<typeof debtSchema>
type PaymentValues = z.infer<typeof paymentSchema>

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

function termLabel(termMonths: number) {
  return termMonths === 0 ? 'Revolving' : `${termMonths} cuota${termMonths !== 1 ? 's' : ''}`
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function Component() {
  const { formatAmount } = useUIStore()

  const debts = useLiveQuery(() => db.debts.orderBy('name').toArray(), [])
  const creditCards = useLiveQuery(() => db.creditCards.orderBy('name').toArray(), [])

  // Dialog state
  const [debtOpen, setDebtOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null)
  const [deletingDebtId, setDeletingDebtId] = useState<number | null>(null)
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null)
  const [historyDebt, setHistoryDebt] = useState<Debt | null>(null)

  // ── Debt form ────────────────────────────────────────────────────────────────
  const debtForm = useForm<DebtValues>({
    resolver: zodResolver(debtSchema),
    defaultValues: { origin: 'other', termMonths: 0, annualRate: 0, currentBalance: 0 },
  })

  const watchedOrigin = debtForm.watch('origin')
  const isOther = watchedOrigin === 'other'

  // Origin items for the Select
  const originItems = [
    ...(creditCards?.map((c) => ({ value: `card:${c.id}`, label: c.name })) ?? []),
    { value: 'other', label: 'Otros (banco / entidad)' },
  ]

  function openCreateDebt() {
    debtForm.reset({ origin: 'other', termMonths: 0, annualRate: 0, currentBalance: 0 })
    setEditingDebt(null)
    setDebtOpen(true)
  }

  function openEditDebt(debt: Debt) {
    debtForm.reset({
      name: debt.name,
      origin: debt.creditCardId ? `card:${debt.creditCardId}` : 'other',
      lenderName: debt.lenderName,
      currentBalance: debt.currentBalance,
      annualRate: debt.annualRate,
      installmentAmount: debt.installmentAmount,
      termMonths: debt.termMonths,
    })
    setEditingDebt(debt)
    setDebtOpen(true)
  }

  async function onDebtSubmit(values: DebtValues) {
    const creditCardId = values.origin.startsWith('card:')
      ? Number(values.origin.split(':')[1])
      : undefined
    const lenderName = values.origin === 'other' ? (values.lenderName?.trim() || undefined) : undefined
    const type: Debt['type'] = creditCardId ? 'credit_card' : 'loan'

    const payload = {
      name: values.name,
      type,
      currentBalance: values.currentBalance,
      annualRate: values.annualRate,
      installmentAmount: values.installmentAmount,
      termMonths: values.termMonths,
      creditCardId,
      lenderName,
    }

    if (editingDebt?.id) {
      await debtsRepo.update(editingDebt.id, payload)
    } else {
      await debtsRepo.create(payload)
    }
    setDebtOpen(false)
    debtForm.reset()
    setEditingDebt(null)
  }

  // ── Payment form ─────────────────────────────────────────────────────────────
  const paymentForm = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { date: toDateInput(new Date()) },
  })

  function openPayment(debt: Debt) {
    paymentForm.reset({ date: toDateInput(new Date()) })
    setPaymentDebt(debt)
  }

  async function onPaymentSubmit(values: PaymentValues) {
    if (!paymentDebt?.id) return
    await debtPaymentsRepo.create({
      debtId: paymentDebt.id,
      amount: values.amount,
      date: new Date(values.date + 'T12:00:00'),
      note: values.note || undefined,
    })
    setPaymentDebt(null)
    paymentForm.reset()
  }

  // ── Consolidated summary ─────────────────────────────────────────────────────
  const consolidated = debts ? calcConsolidatedDebt(debts) : null
  const cardMap = new Map(creditCards?.map((c) => [c.id!, c]) ?? [])

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deudas</h1>
        <Button onClick={openCreateDebt}>+ Deuda</Button>
      </div>

      {/* Consolidated summary */}
      {consolidated && consolidated.items.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Deuda total', value: consolidated.totalBalance, color: 'text-red-500' },
            { label: 'Cuota total', value: consolidated.totalInstallmentAmount, color: 'text-foreground' },
            { label: 'Interés mensual', value: consolidated.totalMonthlyInterest, color: 'text-yellow-600 dark:text-yellow-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border p-2 sm:p-4">
              <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
              <p className={`mt-1 text-base sm:text-xl font-bold tabular-nums ${color}`}>
                {formatAmount(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Debt list */}
      {!debts || debts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No hay deudas registradas.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Usa "+ Deuda" para agregar una tarjeta diferida o préstamo.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {consolidated!.items.map(({ debt, monthlyInterest, monthsToPayoff }) => {
            const cardName = debt.creditCardId ? cardMap.get(debt.creditCardId)?.name : undefined
            const originLabel = cardName ?? debt.lenderName ?? '—'

            return (
              <div key={debt.id} className="px-4 py-4 space-y-3">
                {/* Name + balance + actions */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{debt.name}</p>
                    <p className="text-xs text-muted-foreground">{originLabel}</p>
                    <p className={`text-xl font-bold tabular-nums ${debt.currentBalance > 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                      {formatAmount(debt.currentBalance)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => openPayment(debt)}>
                      + Pago
                    </Button>
                    <button
                      onClick={() => setHistoryDebt(debt)}
                      className="rounded p-1.5 text-xs text-muted-foreground hover:text-foreground"
                      title="Ver historial"
                    >
                      ☰
                    </button>
                    <button
                      onClick={() => openEditDebt(debt)}
                      className="rounded p-1.5 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                    >
                      ✏
                    </button>
                    <button
                      onClick={() => setDeletingDebtId(debt.id!)}
                      className="rounded p-1.5 text-xs text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Tasa:{' '}
                    <span className="font-medium text-foreground">{debt.annualRate}% anual</span>
                  </span>
                  <span>
                    Cuota:{' '}
                    <span className="font-medium text-foreground">{formatAmount(debt.installmentAmount)}</span>
                  </span>
                  <span>
                    Plazo:{' '}
                    <span className="font-medium text-foreground">{termLabel(debt.termMonths)}</span>
                  </span>
                  <span>
                    Interés mensual:{' '}
                    <span className="font-medium text-yellow-600 dark:text-yellow-400">
                      {formatAmount(monthlyInterest)}
                    </span>
                  </span>
                  <span>
                    Liquidación:{' '}
                    <span className="font-medium text-foreground">
                      {isFinite(monthsToPayoff)
                        ? `${monthsToPayoff} mes${monthsToPayoff !== 1 ? 'es' : ''}`
                        : 'Solo cubre interés'}
                    </span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Payoff simulator */}
      {debts && debts.length >= 2 && <PayoffSimulator debts={debts} />}

      {/* ── Create / Edit debt dialog ── */}
      <Dialog
        open={debtOpen}
        onOpenChange={(o) => { if (!o) { setDebtOpen(false); setEditingDebt(null) } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDebt ? 'Editar deuda' : 'Nueva deuda'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={debtForm.handleSubmit(onDebtSubmit)} className="space-y-4">
            {/* Description */}
            <div className="space-y-1">
              <Label htmlFor="debt-name">Descripción</Label>
              <Input
                id="debt-name"
                placeholder="ej. iPhone 15, Sofá, Préstamo auto"
                {...debtForm.register('name')}
              />
              {debtForm.formState.errors.name && (
                <p className="text-xs text-destructive">{debtForm.formState.errors.name.message}</p>
              )}
            </div>

            {/* Origin */}
            <div className="space-y-1">
              <Label>Origen</Label>
              <Select
                items={originItems}
                onValueChange={(v: string | null) => {
                  if (v) {
                    debtForm.setValue('origin', v)
                    if (v !== 'other') debtForm.setValue('lenderName', '')
                  }
                }}
                defaultValue={editingDebt
                  ? (editingDebt.creditCardId ? `card:${editingDebt.creditCardId}` : 'other')
                  : 'other'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tarjeta o entidad" />
                </SelectTrigger>
                <SelectContent>
                  {creditCards?.map((c) => (
                    <SelectItem key={c.id} value={`card:${c.id}`}>{c.name}</SelectItem>
                  ))}
                  <SelectItem value="other">Otros (banco / entidad)</SelectItem>
                </SelectContent>
              </Select>
              {debtForm.formState.errors.origin && (
                <p className="text-xs text-destructive">{debtForm.formState.errors.origin.message}</p>
              )}
            </div>

            {/* Lender name — only when "Otros" is selected */}
            {isOther && (
              <div className="space-y-1">
                <Label htmlFor="lender-name">Nombre de la entidad</Label>
                <Input
                  id="lender-name"
                  placeholder="ej. Bancolombia, Nequi, Familiar"
                  {...debtForm.register('lenderName')}
                />
                {debtForm.formState.errors.lenderName && (
                  <p className="text-xs text-destructive">{debtForm.formState.errors.lenderName.message}</p>
                )}
              </div>
            )}

            {/* Balance + Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="debt-balance">Saldo actual</Label>
                <Input
                  id="debt-balance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...debtForm.register('currentBalance', { valueAsNumber: true })}
                />
                {debtForm.formState.errors.currentBalance && (
                  <p className="text-xs text-destructive">{debtForm.formState.errors.currentBalance.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="debt-rate">Tasa anual (%)</Label>
                <Input
                  id="debt-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...debtForm.register('annualRate', { valueAsNumber: true })}
                />
              </div>
            </div>

            {/* Installment + Term */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="debt-installment">Valor de cuota</Label>
                <Input
                  id="debt-installment"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...debtForm.register('installmentAmount', { valueAsNumber: true })}
                />
                {debtForm.formState.errors.installmentAmount && (
                  <p className="text-xs text-destructive">{debtForm.formState.errors.installmentAmount.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Diferido</Label>
                <Select
                  items={TERM_OPTIONS}
                  onValueChange={(v: string | null) => {
                    if (v !== null) debtForm.setValue('termMonths', Number(v))
                  }}
                  defaultValue={String(editingDebt?.termMonths ?? 0)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERM_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => { setDebtOpen(false); setEditingDebt(null) }}>
                Cancelar
              </Button>
              <Button type="submit">{editingDebt ? 'Guardar' : 'Crear deuda'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Payment dialog ── */}
      <Dialog open={!!paymentDebt} onOpenChange={(o) => !o && setPaymentDebt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago — {paymentDebt?.name}</DialogTitle>
          </DialogHeader>
          {paymentDebt && (
            <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="pay-amount">Monto</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...paymentForm.register('amount', { valueAsNumber: true })}
                />
                {paymentForm.formState.errors.amount && (
                  <p className="text-xs text-destructive">{paymentForm.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-date">Fecha</Label>
                <Input id="pay-date" type="date" {...paymentForm.register('date')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-note">Nota (opcional)</Label>
                <Textarea id="pay-note" rows={2} {...paymentForm.register('note')} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setPaymentDebt(null)}>
                  Cancelar
                </Button>
                <Button type="submit">Registrar pago</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Payment history dialog ── */}
      {historyDebt && (
        <PaymentHistory debt={historyDebt} onClose={() => setHistoryDebt(null)} />
      )}

      {/* ── Delete debt confirm ── */}
      <AlertDialog open={!!deletingDebtId} onOpenChange={(o) => !o && setDeletingDebtId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar deuda?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la deuda y todo su historial de pagos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deletingDebtId) {
                  const payments = await db.debtPayments.where('debtId').equals(deletingDebtId).toArray()
                  await db.debtPayments.bulkDelete(payments.map((p) => p.id!))
                  await debtsRepo.remove(deletingDebtId)
                }
                setDeletingDebtId(null)
              }}
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

// ─── Payment history sub-dialog ────────────────────────────────────────────────

function PaymentHistory({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const { formatAmount } = useUIStore()
  const payments = useLiveQuery(
    () => db.debtPayments.where('debtId').equals(debt.id!).reverse().sortBy('date'),
    [debt.id],
  )

  const [deletingPayment, setDeletingPayment] = useState<DebtPayment | null>(null)

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial de pagos — {debt.name}</DialogTitle>
          </DialogHeader>

          {!payments || payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin pagos registrados aún.
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border max-h-80 overflow-y-auto">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium tabular-nums text-green-600 dark:text-green-400">
                      -{formatAmount(p.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(p.date, "d 'de' MMMM yyyy", { locale: es })}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeletingPayment(p)}
                    className="rounded p-1 text-xs text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Eliminar pago"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <Separator />
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingPayment} onOpenChange={(o) => !o && setDeletingPayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              El saldo de la deuda no se restaurará automáticamente. Edita la deuda si necesitas corregirlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deletingPayment?.id) await debtPaymentsRepo.remove(deletingPayment.id)
                setDeletingPayment(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
