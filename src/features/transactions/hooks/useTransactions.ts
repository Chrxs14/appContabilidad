import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { useUIStore } from '@/store/uiStore'
import type { TransactionFilters } from '@/db/transactions.repo'

/** All transactions in the active billing period, ordered by date descending. */
export function usePeriodTransactions(extraFilters?: Partial<TransactionFilters>) {
  const { activePeriod } = useUIStore()
  const { year, month } = activePeriod

  return useLiveQuery(
    () =>
      db.transactions
        .where('[billingYear+billingMonth]')
        .equals([year, month])
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
    [year, month, JSON.stringify(extraFilters)],
  )
}

/** All transactions ever (for balance calculations). */
export function useAllTransactions() {
  return useLiveQuery(() => db.transactions.toArray(), [])
}
