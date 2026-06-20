import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { db, reimbursementsRepo } from '@/db'
import type { Reimbursement } from '@/db/types'
import { useUIStore } from '@/store/uiStore'
import { groupByPerson, sortGroupsByAmount, calcTotalPending } from '@/domain/reimbursements'
import type { PersonGroup } from '@/domain/reimbursements'
import { MarkPaidDialog } from './components/MarkPaidDialog'

// ── ReimbursementGroup ────────────────────────────────────────────────────────

interface GroupProps {
  group: PersonGroup
  transactionMap: Map<number, { categoryId: number; date: Date; note?: string }>
  categoryMap: Map<number, { name: string; color: string }>
  onMarkPaid: (r: Reimbursement) => void
  formatAmount: (n: number) => string
}

function ReimbursementGroup({
  group,
  transactionMap,
  categoryMap,
  onMarkPaid,
  formatAmount,
}: GroupProps) {
  const hasPending = group.pendingTotal > 0

  return (
    <div className="rounded-lg border">
      {/* Group header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{group.personName}</p>
          {hasPending && (
            <p className="text-muted-foreground text-xs">
              {group.items.filter((r) => !r.isPaid).length} pendiente
              {group.items.filter((r) => !r.isPaid).length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {hasPending && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            {formatAmount(group.pendingTotal)}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-border">
        {group.items.map((r) => {
          const tx = transactionMap.get(r.transactionId)
          const category = tx ? categoryMap.get(tx.categoryId) : undefined

          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
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
                {tx && (
                  <p className="text-muted-foreground text-xs">
                    {format(new Date(tx.date), "d 'de' MMMM", { locale: es })}
                    {tx.note ? ` · ${tx.note}` : ''}
                  </p>
                )}
              </div>

              {/* Amount */}
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatAmount(r.amount)}
              </span>

              {/* Status / action */}
              {r.isPaid ? (
                <span className="shrink-0 text-xs text-muted-foreground">✓ Cobrado</span>
              ) : (
                <button
                  onClick={() => onMarkPaid(r)}
                  className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
                >
                  Cobrar
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Component() {
  const { formatAmount } = useUIStore()
  const [showAll, setShowAll] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<Reimbursement | null>(null)

  const reimbursements = useLiveQuery(() => reimbursementsRepo.getAll(), [])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  const transactionMap = new Map(
    (transactions ?? []).map((t) => [
      t.id!,
      { categoryId: t.categoryId, date: t.date, note: t.note },
    ]),
  )
  const categoryMap = new Map(
    (categories ?? []).map((c) => [c.id!, { name: c.name, color: c.color }]),
  )

  const allReimbursements = reimbursements ?? []
  const totalPending = calcTotalPending(allReimbursements)
  const pendingItems = allReimbursements.filter((r) => !r.isPaid)
  const pendingPersonCount = new Set(
    pendingItems.map((r) => r.personName.toLowerCase().trim()),
  ).size

  const filtered = showAll ? allReimbursements : pendingItems
  const groups = sortGroupsByAmount(groupByPerson(filtered))

  const isEmpty = groups.length === 0

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cobros</h1>
      </div>

      {/* Summary card — only when there are pending */}
      {totalPending > 0 && (
        <div className="rounded-lg border bg-amber-50 px-4 py-3 dark:bg-amber-900/10">
          <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatAmount(totalPending)}
          </p>
          <p className="text-muted-foreground text-sm">
            pendiente{pendingItems.length !== 1 ? 's' : ''} de{' '}
            {pendingPersonCount} persona{pendingPersonCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Toggle */}
      <div className="flex gap-2">
        {(
          [
            { key: false, label: `Pendientes (${pendingItems.length})` },
            { key: true,  label: `Todos (${allReimbursements.length})` },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={String(key)}
            type="button"
            onClick={() => setShowAll(key)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              showAll === key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isEmpty ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground text-sm">
            {showAll
              ? 'No has registrado ningún cobro aún.'
              : '¡Todo al día! No tienes cobros pendientes.'}
          </p>
          {!showAll && allReimbursements.length > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
            >
              Ver historial
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <ReimbursementGroup
              key={group.personName.toLowerCase().trim()}
              group={group}
              transactionMap={transactionMap}
              categoryMap={categoryMap}
              onMarkPaid={setMarkingPaid}
              formatAmount={formatAmount}
            />
          ))}
        </div>
      )}

      <MarkPaidDialog
        reimbursement={markingPaid}
        open={!!markingPaid}
        onClose={() => setMarkingPaid(null)}
      />
    </div>
  )
}
