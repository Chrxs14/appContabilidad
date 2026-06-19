import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { calcAccountBalance, calcAccountDistribution } from '@/domain/summaries'

export function useAccounts() {
  return useLiveQuery(() => db.accounts.orderBy('name').toArray(), [])
}

export function useAccountsWithBalances() {
  const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray(), [])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])

  if (!accounts || !transactions) return undefined

  return accounts.map((a) => calcAccountBalance(a, transactions))
}

export function useAccountDistribution() {
  const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray(), [])
  const transactions = useLiveQuery(() => db.transactions.toArray(), [])

  if (!accounts || !transactions) return undefined

  return calcAccountDistribution(accounts, transactions)
}
