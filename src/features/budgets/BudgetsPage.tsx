import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, budgetsRepo } from '@/db'
import type { Budget } from '@/db/types'
import { useUIStore } from '@/store/uiStore'
import { calcPeriodBudgets } from '@/domain/budget'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { PeriodSelector } from '@/features/transactions/components/PeriodSelector'
import { BudgetChart } from './BudgetChart'

const NEAR_THRESHOLD = 0.9

const schema = z.object({
  categoryId: z.number().positive({ message: 'Selecciona una categoría' }),
  limitAmount: z.number().positive({ message: 'El límite debe ser mayor a 0' }),
})

type FormValues = z.infer<typeof schema>

function StatusBadge({ status }: { status: 'ok' | 'near' | 'over' }) {
  if (status === 'over')
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-400">
        Rebasado
      </span>
    )
  if (status === 'near')
    return (
      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-400">
        Cerca
      </span>
    )
  return null
}

export function Component() {
  const { activePeriod, formatAmount } = useUIStore()
  const { month, year } = activePeriod

  const budgets = useLiveQuery(() => budgetsRepo.getByPeriod(year, month), [year, month])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const expenseCategories = useLiveQuery(
    () => db.categories.where('type').equals('expense').sortBy('name'),
    [],
  )

  const [open, setOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [copying, setCopying] = useState(false)
  const [copyResult, setCopyResult] = useState<string | null>(null)

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const usedCategoryIds = new Set(budgets?.map((b) => b.categoryId) ?? [])

  function openCreate() {
    reset({ limitAmount: undefined as unknown as number })
    setEditingBudget(null)
    setOpen(true)
  }

  function openEdit(budget: Budget) {
    reset({ categoryId: budget.categoryId, limitAmount: budget.limitAmount })
    setEditingBudget(budget)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    if (editingBudget?.id) {
      await budgetsRepo.update(editingBudget.id, { limitAmount: values.limitAmount })
    } else {
      await budgetsRepo.create({ categoryId: values.categoryId, limitAmount: values.limitAmount, month, year })
    }
    setOpen(false)
    reset()
    setEditingBudget(null)
  }

  async function handleCopy() {
    setCopying(true)
    setCopyResult(null)
    try {
      const count = await budgetsRepo.copyFromPreviousMonth(year, month)
      setCopyResult(
        count > 0
          ? `Se copiaron ${count} presupuesto(s) del mes anterior.`
          : 'No hay presupuestos en el mes anterior.',
      )
    } finally {
      setCopying(false)
    }
  }

  const categoryMap = new Map(expenseCategories?.map((c) => [c.id!, c]) ?? [])

  const summary =
    budgets && transactions ? calcPeriodBudgets(budgets, transactions, NEAR_THRESHOLD) : null

  const availableCategories = expenseCategories?.filter(
    (c) => !usedCategoryIds.has(c.id!) || editingBudget?.categoryId === c.id,
  )

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Presupuestos</h1>
        <div className="flex gap-2">
          {(!budgets || budgets.length === 0) && (
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={copying}>
              {copying ? 'Copiando…' : 'Copiar mes anterior'}
            </Button>
          )}
          <Button onClick={openCreate}>+ Presupuesto</Button>
        </div>
      </div>

      <PeriodSelector />

      {copyResult && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{copyResult}</p>
      )}

      {/* Summary totals */}
      {summary && summary.items.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Presupuestado', value: summary.totalLimit, color: 'text-foreground' },
            {
              label: 'Gastado',
              value: summary.totalSpent,
              color: summary.totalSpent > summary.totalLimit ? 'text-red-500' : 'text-foreground',
            },
            {
              label: 'Disponible',
              value: summary.totalRemaining,
              color: summary.totalRemaining < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>
                {value < 0 ? '-' : ''}
                {formatAmount(Math.abs(value))}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Budget list */}
      {!summary || summary.items.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No hay presupuestos para este mes.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Usa "+ Presupuesto" o copia los del mes anterior.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {summary.items.map(({ budget, spent, limit, remaining, percentage, status }) => {
            const category = categoryMap.get(budget.categoryId)
            const barPct = Math.min(percentage, 100)
            const barColor =
              status === 'over'
                ? 'bg-red-500'
                : status === 'near'
                  ? 'bg-yellow-400'
                  : 'bg-primary/70'

            return (
              <div key={budget.id} className="space-y-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  {category && (
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: category.color }}
                    />
                  )}
                  <span className="flex-1 text-sm font-medium">{category?.name ?? '—'}</span>
                  <StatusBadge status={status} />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatAmount(spent)} / {formatAmount(limit)}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(budget)}
                      className="rounded p-1 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Editar"
                    >
                      ✏
                    </button>
                    <button
                      onClick={() => setDeletingId(budget.id!)}
                      className="rounded p-1 text-xs text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{percentage.toFixed(0)}% utilizado</span>
                  <span>
                    {remaining >= 0
                      ? `${formatAmount(remaining)} disponible`
                      : `${formatAmount(Math.abs(remaining))} sobre el límite`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Month-over-month comparison chart */}
      <BudgetChart />

      {/* Create / Edit dialog */}
      <Dialog
        open={open}
        onOpenChange={(o: boolean) => {
          if (!o) {
            setOpen(false)
            setEditingBudget(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Editar presupuesto' : 'Nuevo presupuesto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!editingBudget && (
              <div className="space-y-1">
                <Label>Categoría de egreso</Label>
                <Select
                  items={availableCategories?.map((c) => ({ value: String(c.id), label: c.name })) ?? []}
                  onValueChange={(v: string | null) => {
                    if (v) setValue('categoryId', Number(v))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories?.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="inline-block size-2 shrink-0 rounded-full"
                            style={{ background: c.color }}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && (
                  <p className="text-xs text-destructive">{errors.categoryId.message}</p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="limit">Límite mensual</Label>
              <Input
                id="limit"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                {...register('limitAmount', { valueAsNumber: true })}
              />
              {errors.limitAmount && (
                <p className="text-xs text-destructive">{errors.limitAmount.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false)
                  setEditingBudget(null)
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">{editingBudget ? 'Guardar' : 'Crear presupuesto'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o: boolean) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deletingId) await budgetsRepo.remove(deletingId)
                setDeletingId(null)
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
