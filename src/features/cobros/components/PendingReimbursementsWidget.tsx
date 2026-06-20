import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { reimbursementsRepo } from '@/db'
import { useUIStore } from '@/store/uiStore'
import { groupByPerson, sortGroupsByAmount, calcTotalPending } from '@/domain/reimbursements'

export function PendingReimbursementsWidget() {
  const { formatAmount } = useUIStore()
  const pending = useLiveQuery(() => reimbursementsRepo.getPending(), [])

  if (!pending || pending.length === 0) return null

  const total = calcTotalPending(pending)
  const groups = sortGroupsByAmount(groupByPerson(pending))
  const visibleGroups = groups.slice(0, 3)
  const hiddenCount = groups.length - visibleGroups.length

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Cobros pendientes
      </p>
      <div className="rounded-lg border px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {formatAmount(total)}
          </p>
          <Link
            to="/cobros"
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Ver todos →
          </Link>
        </div>

        <div className="space-y-1.5">
          {visibleGroups.map((group) => (
            <div
              key={group.personName.toLowerCase()}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate">{group.personName}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatAmount(group.pendingTotal)}
              </span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground">+{hiddenCount} persona{hiddenCount !== 1 ? 's' : ''} más</p>
          )}
        </div>
      </div>
    </div>
  )
}
