import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { db, reimbursementsRepo, transactionsRepo } from '@/db'
import type { Reimbursement } from '@/db/types'
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
  reimbursement: Reimbursement | null
  open: boolean
  onClose: () => void
}

export function MarkPaidDialog({ reimbursement, open, onClose }: Props) {
  const { formatAmount } = useUIStore()
  const [createIncome, setCreateIncome] = useState(true)
  const [accountId, setAccountId] = useState<number | undefined>()
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [submitting, setSubmitting] = useState(false)

  const txData = useLiveQuery(
    async () => {
      if (!reimbursement) return null
      const tx = await db.transactions.get(reimbursement.transactionId)
      if (!tx) return null
      const cat = await db.categories.get(tx.categoryId)
      return { transaction: tx, txCategory: cat }
    },
    [reimbursement?.id],
  )

  const transaction = txData?.transaction
  const txCategory = txData?.txCategory

  const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray(), [])
  const incomeCategories = useLiveQuery(
    () => db.categories.where('type').equals('income').sortBy('name'),
    [],
  )
  const defaultAccountId = useLiveQuery(
    () => db.accounts.filter((a) => a.isDefault).first().then((a) => a?.id),
    [],
  )

  useEffect(() => {
    if (defaultAccountId && !accountId) setAccountId(defaultAccountId)
  }, [defaultAccountId, accountId])

  useEffect(() => {
    if (incomeCategories?.length && !categoryId) setCategoryId(incomeCategories[0]?.id)
  }, [incomeCategories, categoryId])

  // Reset state when dialog opens for a new reimbursement
  useEffect(() => {
    if (open) {
      setCreateIncome(true)
      setSubmitting(false)
    }
  }, [open, reimbursement?.id])

  async function handleConfirm() {
    if (!reimbursement?.id) return
    setSubmitting(true)
    try {
      let incomeTransactionId: number | undefined
      if (createIncome && accountId && categoryId) {
        incomeTransactionId = await transactionsRepo.create({
          type: 'income',
          amount: reimbursement.amount,
          date: new Date(),
          categoryId,
          accountId,
          note: `Cobro: ${reimbursement.personName}`,
          isRecurring: false,
        })
      }
      await reimbursementsRepo.markAsPaid(reimbursement.id, new Date(), incomeTransactionId)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const canConfirm = !createIncome || (!!accountId && !!categoryId)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como cobrado</DialogTitle>
        </DialogHeader>

        {reimbursement && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
              <p className="text-sm font-medium">{reimbursement.personName}</p>
              <p className="text-xl font-bold tabular-nums">
                {formatAmount(reimbursement.amount)}
              </p>
              {transaction && (
                <p className="text-muted-foreground text-xs">
                  {txCategory?.name ?? 'Sin categoría'}
                  {' · '}
                  {format(new Date(transaction.date), "d 'de' MMMM yyyy", { locale: es })}
                </p>
              )}
            </div>

            {/* Toggle: register income */}
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={createIncome}
                onChange={(e) => setCreateIncome(e.target.checked)}
              />
              <span className="text-sm">Registrar como ingreso</span>
            </label>

            {createIncome && (
              <div className="space-y-3 pl-6">
                {/* Account select */}
                <div className="space-y-1">
                  <Label>Cuenta destino</Label>
                  <Select
                    value={accountId?.toString()}
                    onValueChange={(v: string | null) =>
                      setAccountId(v ? Number(v) : undefined)
                    }
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

                {/* Income category select */}
                <div className="space-y-1">
                  <Label>Categoría</Label>
                  <Select
                    value={categoryId?.toString()}
                    onValueChange={(v: string | null) =>
                      setCategoryId(v ? Number(v) : undefined)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {incomeCategories?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={onClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={submitting || !canConfirm}>
                {submitting ? 'Guardando…' : 'Confirmar cobro'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
