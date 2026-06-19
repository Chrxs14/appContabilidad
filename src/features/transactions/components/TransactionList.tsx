import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { db, transactionsRepo } from '@/db'
import type { Transaction } from '@/db/types'
import { useUIStore } from '@/store/uiStore'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TransactionForm } from './TransactionForm'
import { usePeriodTransactions } from '../hooks/useTransactions'
import type { FilterState } from './FilterBar'

interface Props {
  filters?: FilterState
}

function groupByDay(transactions: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const key = format(tx.date, 'yyyy-MM-dd')
    const group = map.get(key) ?? []
    group.push(tx)
    map.set(key, group)
  }
  return map
}

export function TransactionList({ filters }: Props) {
  const { formatAmount } = useUIStore()

  // Translate FilterState → TransactionFilters
  const sourceFilter = filters?.source
  const accountId = sourceFilter?.startsWith('account:')
    ? Number(sourceFilter.split(':')[1])
    : undefined
  const creditCardId = sourceFilter?.startsWith('card:')
    ? Number(sourceFilter.split(':')[1])
    : undefined

  const transactions = usePeriodTransactions({
    type: filters?.type,
    categoryId: filters?.categoryId,
    accountId,
    creditCardId,
    search: filters?.search || undefined,
  })

  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const creditCards = useLiveQuery(() => db.creditCards.toArray(), [])

  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)

  if (!transactions) return <p className="text-muted-foreground text-sm">Cargando…</p>

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <p className="text-muted-foreground text-sm">No hay movimientos en este periodo.</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Usa el botón "+ Movimiento" para registrar el primero.
        </p>
      </div>
    )
  }

  const categoryMap = new Map(categories?.map((c) => [c.id!, c]) ?? [])
  const accountMap = new Map(accounts?.map((a) => [a.id!, a]) ?? [])
  const cardMap = new Map(creditCards?.map((c) => [c.id!, c]) ?? [])

  const grouped = groupByDay(transactions)

  return (
    <>
      <div className="space-y-4">
        {[...grouped.entries()].map(([day, txs]) => (
          <div key={day}>
            <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
              {format(new Date(day + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
            </p>

            <div className="divide-y divide-border rounded-lg border">
              {txs.map((tx) => {
                const category = categoryMap.get(tx.categoryId)
                const source = tx.accountId
                  ? accountMap.get(tx.accountId)?.name
                  : tx.creditCardId
                    ? cardMap.get(tx.creditCardId)?.name
                    : '—'

                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    {/* Color dot */}
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: category?.color ?? '#9ca3af' }}
                    />

                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {category?.name ?? 'Sin categoría'}
                      </p>
                      <p className="text-muted-foreground text-xs truncate">
                        {source}
                        {tx.note ? ` · ${tx.note}` : ''}
                      </p>
                    </div>

                    {/* Amount */}
                    <span
                      className={`text-sm font-semibold tabular-nums shrink-0 ${
                        tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatAmount(tx.amount)}
                    </span>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setEditing(tx)}
                        className="text-muted-foreground hover:text-foreground rounded p-1 text-xs transition-colors"
                        aria-label="Editar"
                      >
                        ✏
                      </button>
                      <button
                        onClick={() => setDeleting(tx)}
                        className="text-muted-foreground hover:text-destructive rounded p-1 text-xs transition-colors"
                        aria-label="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open: boolean) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar movimiento</DialogTitle>
          </DialogHeader>
          {editing && (
            <TransactionForm
              editing={editing}
              onSuccess={() => setEditing(null)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(open: boolean) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleting?.id) await transactionsRepo.remove(deleting.id)
                setDeleting(null)
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
