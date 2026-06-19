import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, transactionsRepo } from '@/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Transaction } from '@/db/types'

const schema = z
  .object({
    type: z.enum(['income', 'expense']),
    amount: z.number().positive({ message: 'El monto debe ser mayor a 0' }),
    date: z.string().min(1, 'La fecha es requerida'),
    categoryId: z.number().positive({ message: 'Selecciona una categoría' }),
    accountId: z.number().optional(),
    creditCardId: z.number().optional(),
    note: z.string().optional(),
    isRecurring: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.type === 'income') return !!data.accountId
      return !!data.accountId || !!data.creditCardId
    },
    { message: 'Selecciona una cuenta o tarjeta', path: ['accountId'] },
  )

type FormValues = z.infer<typeof schema>

interface Props {
  editing?: Transaction
  onSuccess?: () => void
  onCancel?: () => void
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function TransactionForm({ editing, onSuccess, onCancel }: Props) {
  const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray(), [])
  const creditCards = useLiveQuery(() => db.creditCards.orderBy('name').toArray(), [])
  const defaultAccountId = useLiveQuery(
    () => db.accounts.filter((a) => a.isDefault).first().then((a) => a?.id),
    [],
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          type: editing.type,
          amount: editing.amount,
          date: toDateInputValue(editing.date),
          categoryId: editing.categoryId,
          accountId: editing.accountId,
          creditCardId: editing.creditCardId,
          note: editing.note ?? '',
          isRecurring: editing.isRecurring,
        }
      : {
          type: 'expense',
          date: toDateInputValue(new Date()),
          isRecurring: false,
        },
  })

  const type = watch('type')
  const categories = useLiveQuery(
    () => db.categories.where('type').equals(type).sortBy('name'),
    [type],
  )

  // Set default account when accounts load (only for new transactions)
  useEffect(() => {
    if (!editing && defaultAccountId) {
      setValue('accountId', defaultAccountId)
    }
  }, [defaultAccountId, editing, setValue])

  // When switching to income, clear creditCardId
  useEffect(() => {
    if (type === 'income') setValue('creditCardId', undefined)
  }, [type, setValue])

  async function onSubmit(values: FormValues) {
    const payload = {
      type: values.type,
      amount: values.amount,
      date: new Date(values.date + 'T12:00:00'),
      categoryId: values.categoryId,
      accountId: values.accountId,
      creditCardId: values.creditCardId,
      note: values.note || undefined,
      isRecurring: values.isRecurring,
    }

    if (editing?.id) {
      await transactionsRepo.update(editing.id, payload)
    } else {
      await transactionsRepo.create(payload)
    }

    reset()
    onSuccess?.()
  }

  const destinationLabel = type === 'income' ? 'Cuenta destino' : 'Cuenta / Tarjeta'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type */}
      <div className="flex gap-2">
        {(['income', 'expense'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setValue('type', t)}
            className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
              type === t
                ? t === 'income'
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-red-500 bg-red-500 text-white'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {t === 'income' ? 'Ingreso' : 'Egreso'}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div className="space-y-1">
        <Label htmlFor="amount">Monto</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('amount', { valueAsNumber: true })}
        />
        {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
      </div>

      {/* Date */}
      <div className="space-y-1">
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" type="date" {...register('date')} />
        {errors.date && <p className="text-destructive text-xs">{errors.date.message}</p>}
      </div>

      {/* Category */}
      <div className="space-y-1">
        <Label>Categoría</Label>
        <Select
          items={categories?.map((c) => ({ value: String(c.id), label: c.name })) ?? []}
          onValueChange={(v: string | null) => setValue('categoryId', Number(v ?? 0))}
          defaultValue={editing?.categoryId?.toString()}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una categoría" />
          </SelectTrigger>
          <SelectContent>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && (
          <p className="text-destructive text-xs">{errors.categoryId.message}</p>
        )}
      </div>

      {/* Account / CreditCard */}
      <div className="space-y-1">
        <Label>{destinationLabel}</Label>
        <Select
          items={[
            ...(accounts?.map((a) => ({ value: `account:${a.id}`, label: a.name })) ?? []),
            ...(type === 'expense'
              ? (creditCards?.map((c) => ({ value: `card:${c.id}`, label: `${c.name} (tarjeta)` })) ?? [])
              : []),
          ]}
          onValueChange={(v: string | null) => {
            if (!v) return
            const [kind, id] = v.split(':')
            if (kind === 'account') {
              setValue('accountId', Number(id))
              setValue('creditCardId', undefined)
            } else {
              setValue('creditCardId', Number(id))
              setValue('accountId', undefined)
            }
          }}
          defaultValue={
            editing?.accountId
              ? `account:${editing.accountId}`
              : editing?.creditCardId
                ? `card:${editing.creditCardId}`
                : undefined
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona cuenta o tarjeta" />
          </SelectTrigger>
          <SelectContent>
            {accounts?.map((a) => (
              <SelectItem key={`account:${a.id}`} value={`account:${a.id}`}>
                {a.name}
              </SelectItem>
            ))}
            {type === 'expense' &&
              creditCards?.map((c) => (
                <SelectItem key={`card:${c.id}`} value={`card:${c.id}`}>
                  {c.name} (tarjeta)
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {errors.accountId && (
          <p className="text-destructive text-xs">{errors.accountId.message}</p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Textarea id="note" rows={2} placeholder="Descripción…" {...register('note')} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {editing ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </div>
    </form>
  )
}
