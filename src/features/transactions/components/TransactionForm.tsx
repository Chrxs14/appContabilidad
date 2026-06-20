import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { db, transactionsRepo, reimbursementsRepo } from '@/db'
import { getBillingPeriod } from '@/domain/billing-cycle'
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
    isPaidByThirdParty: z.boolean(),
    thirdPartyName: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'income') return !!data.accountId
      return !!data.accountId || !!data.creditCardId
    },
    { message: 'Selecciona una cuenta o tarjeta', path: ['accountId'] },
  )
  .refine(
    (data) => {
      if (data.type === 'expense' && data.isPaidByThirdParty) {
        return !!data.thirdPartyName && data.thirdPartyName.trim().length > 0
      }
      return true
    },
    { message: 'Ingresa el nombre de quien paga', path: ['thirdPartyName'] },
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
          isPaidByThirdParty: false,
          thirdPartyName: '',
        }
      : {
          type: 'expense',
          date: toDateInputValue(new Date()),
          isRecurring: false,
          isPaidByThirdParty: false,
          thirdPartyName: '',
        },
  })

  const type = watch('type')
  const isPaidByThirdParty = watch('isPaidByThirdParty')
  const watchedCreditCardId = watch('creditCardId')
  const watchedDate = watch('date')

  const categories = useLiveQuery(
    () => db.categories.where('type').equals(type).sortBy('name'),
    [type],
  )

  const existingReimbursement = useLiveQuery(
    async () => {
      if (!editing?.id) return null
      const r = await reimbursementsRepo.getByTransactionId(editing.id)
      return r ?? null
    },
    [editing?.id],
  )

  // Set default account when accounts load (only for new transactions)
  useEffect(() => {
    if (!editing && defaultAccountId) {
      setValue('accountId', defaultAccountId)
    }
  }, [defaultAccountId, editing, setValue])

  // When switching to income, clear creditCardId and reimbursement fields
  useEffect(() => {
    if (type === 'income') {
      setValue('creditCardId', undefined)
      setValue('isPaidByThirdParty', false)
      setValue('thirdPartyName', '')
    }
  }, [type, setValue])

  // Pre-populate reimbursement fields when editing an existing transaction
  useEffect(() => {
    if (!editing?.id) return
    if (existingReimbursement === undefined) return // still loading
    setValue('isPaidByThirdParty', existingReimbursement !== null)
    setValue('thirdPartyName', existingReimbursement?.personName ?? '')
  }, [editing?.id, existingReimbursement, setValue])

  const billingHint = useMemo(() => {
    if (!watchedCreditCardId || !watchedDate) return null
    const card = creditCards?.find((c) => c.id === watchedCreditCardId)
    if (!card) return null
    const txDate = new Date(watchedDate + 'T12:00:00')
    const { billingYear, billingMonth } = getBillingPeriod(txDate, card.cutDay)
    if (billingYear !== txDate.getFullYear() || billingMonth !== txDate.getMonth() + 1) {
      const label = format(new Date(billingYear, billingMonth - 1, 1), 'MMMM yyyy', { locale: es })
      return `Se reflejará en ${label} (corte: día ${card.cutDay})`
    }
    return null
  }, [watchedCreditCardId, watchedDate, creditCards])

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

    let txId: number
    if (editing?.id) {
      await transactionsRepo.update(editing.id, payload)
      txId = editing.id
    } else {
      txId = await transactionsRepo.create(payload)
    }

    // Reimbursement lifecycle
    const shouldReimburse = values.type === 'expense' && values.isPaidByThirdParty
    const personName = values.thirdPartyName?.trim() ?? ''

    if (shouldReimburse && personName) {
      if (existingReimbursement) {
        if (existingReimbursement.personName !== personName) {
          await reimbursementsRepo.updatePersonName(existingReimbursement.id!, personName)
        }
        // amount is already synced by transactionsRepo.update
      } else {
        await reimbursementsRepo.create({
          transactionId: txId,
          personName,
          amount: values.amount,
          isPaid: false,
        })
      }
    } else if (existingReimbursement) {
      await reimbursementsRepo.remove(existingReimbursement.id!)
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
        {billingHint && (
          <p className="text-xs text-amber-600 dark:text-amber-400">⚠ {billingHint}</p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Textarea id="note" rows={2} placeholder="Descripción…" {...register('note')} />
      </div>

      {/* Third-party reimbursement — only for expenses */}
      {type === 'expense' && (
        <div className="space-y-2 rounded-md border border-dashed px-3 py-2.5">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              {...register('isPaidByThirdParty')}
            />
            <span className="text-sm">Lo paga alguien más</span>
          </label>
          {isPaidByThirdParty && (
            <div className="space-y-1 pl-6">
              <Label htmlFor="thirdPartyName">¿Quién?</Label>
              <Input
                id="thirdPartyName"
                placeholder="Nombre de la persona"
                autoFocus
                {...register('thirdPartyName')}
              />
              {errors.thirdPartyName && (
                <p className="text-destructive text-xs">{errors.thirdPartyName.message}</p>
              )}
            </div>
          )}
        </div>
      )}

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
