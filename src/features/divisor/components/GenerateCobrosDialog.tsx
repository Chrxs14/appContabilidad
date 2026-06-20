import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, transactionsRepo, reimbursementsRepo, billSplitsRepo } from '@/db'
import type { PersonShare } from '@/domain/bill-split'
import { useUIStore } from '@/store/uiStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  splitId: number
  splitTitle: string
  splitDate: Date
  people: string[]
  perPerson: PersonShare[]
  grandTotal: number
}

export function GenerateCobrosDialog({
  open,
  onClose,
  onSuccess,
  splitId,
  splitTitle,
  splitDate,
  people,
  perPerson,
  grandTotal,
}: Props) {
  const { formatAmount } = useUIStore()

  // "null" means "no estoy en la lista" → cobros para todos
  const [myName, setMyName] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<number | undefined>()
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray(), [])
  const expenseCategories = useLiveQuery(
    () => db.categories.where('type').equals('expense').sortBy('name'),
    [],
  )
  const defaultAccountId = useLiveQuery(
    async () => {
      const a = await db.accounts.filter((a) => a.isDefault).first()
      return a?.id
    },
    [],
  )

  useEffect(() => {
    if (defaultAccountId && !accountId) setAccountId(defaultAccountId)
  }, [defaultAccountId, accountId])

  useEffect(() => {
    if (expenseCategories?.length && !categoryId) setCategoryId(expenseCategories[0]?.id)
  }, [expenseCategories, categoryId])

  // Reset on open
  useEffect(() => {
    if (open) {
      setMyName(null)
      setSubmitting(false)
    }
  }, [open])

  const personsToCharge = perPerson.filter((p) => p.name !== myName)
  const totalCobros = personsToCharge.reduce((s, p) => s + p.total, 0)
  const canConfirm = !!accountId && !!categoryId && personsToCharge.length > 0

  async function handleConfirm() {
    if (!accountId || !categoryId) return
    setSubmitting(true)
    try {
      const note = splitTitle.trim()
        ? `Divisor: ${splitTitle}`
        : 'División de cuenta'

      const txId = await transactionsRepo.create({
        type: 'expense',
        amount: grandTotal,
        date: splitDate,
        categoryId,
        accountId,
        note,
        isRecurring: false,
      })

      for (const person of personsToCharge) {
        await reimbursementsRepo.create({
          transactionId: txId,
          personName: person.name,
          amount: person.total,
          isPaid: false,
        })
      }

      await billSplitsRepo.update(splitId, { linkedTransactionId: txId })

      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generar cobros</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Quién pagó */}
          <div className="space-y-2">
            <Label className="text-sm">¿Cuál persona eres tú?</Label>
            <div className="space-y-1.5">
              {people.map((name) => {
                const share = perPerson.find((p) => p.name === name)
                return (
                  <label
                    key={name}
                    className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="myName"
                        checked={myName === name}
                        onChange={() => setMyName(name)}
                        className="accent-primary"
                      />
                      {name}
                    </span>
                    {share && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatAmount(share.total)}
                      </span>
                    )}
                  </label>
                )
              })}
              <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
                <input
                  type="radio"
                  name="myName"
                  checked={myName === null}
                  onChange={() => setMyName(null)}
                  className="accent-primary"
                />
                No estoy en la lista
              </label>
            </div>
          </div>

          {/* Resumen de cobros */}
          {personsToCharge.length > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2.5 space-y-1.5 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Cobros que se generarán:
              </p>
              {personsToCharge.map((p) => (
                <div key={p.name} className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>{p.name}</span>
                  <span className="tabular-nums">{formatAmount(p.total)}</span>
                </div>
              ))}
              {myName !== null && (
                <div className="flex justify-between border-t border-amber-200 dark:border-amber-800 pt-1.5 font-medium text-amber-800 dark:text-amber-300">
                  <span>Total a recuperar</span>
                  <span className="tabular-nums">{formatAmount(totalCobros)}</span>
                </div>
              )}
            </div>
          )}

          {personsToCharge.length === 0 && myName !== null && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Si eres la única persona, no hay cobros que generar.
            </p>
          )}

          {/* Cuenta destino */}
          <div className="space-y-1.5">
            <Label>Registrar egreso en cuenta</Label>
            <Select
              value={accountId?.toString()}
              onValueChange={(v) => setAccountId(v ? Number(v) : undefined)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoría del egreso */}
          <div className="space-y-1.5">
            <Label>Categoría del egreso</Label>
            <Select
              value={categoryId?.toString()}
              onValueChange={(v) => setCategoryId(v ? Number(v) : undefined)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={submitting || !canConfirm}>
              {submitting ? 'Generando…' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
