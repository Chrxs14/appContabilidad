import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { periodToRange } from '@/lib/dates'
import { useUIStore } from '@/store/uiStore'
import type { TransactionFilters } from '@/db/transactions.repo'

/** All transactions in the active period, ordered by date descending. */
export function usePeriodTransactions(extraFilters?: Partial<TransactionFilters>) {
  const { activePeriod } = useUIStore()
  const { from, to } = periodToRange(activePeriod)

  return useLiveQuery(
    () =>
      db.transactions
        .where('date')
        .between(from, to, true, true)
        .toArray()
        .then((txs) => {
          let result = txs
          if (extraFilters?.type) result = result.filter((t) => t.type === extraFilters.type)
          if (extraFilters?.categoryId !== undefined)
            result = result.filter((t) => t.categoryId === extraFilters.categoryId)
          if (extraFilters?.accountId !== undefined)
            result = result.filter((t) => t.accountId === extraFilters.accountId)
          if (extraFilters?.creditCardId !== undefined)
            result = result.filter((t) => t.creditCardId === extraFilters.creditCardId)
          if (extraFilters?.search) {
            const q = extraFilters.search.toLowerCase()
            result = result.filter((t) => t.note?.toLowerCase().includes(q))
          }
          return result.sort((a, b) => b.date.getTime() - a.date.getTime())
        }),
    [from.getTime(), to.getTime(), JSON.stringify(extraFilters)],
  )
}

/** All transactions ever (for balance calculations). */
export function useAllTransactions() {
  return useLiveQuery(() => db.transactions.toArray(), [])
}
