import { db } from './db'
import type { Transaction, TransactionType } from './types'

export interface TransactionFilters {
  type?: TransactionType
  categoryId?: number
  accountId?: number
  creditCardId?: number
  from?: Date
  to?: Date
  search?: string   // matches against note (case-insensitive)
}

export const transactionsRepo = {
  getAll() {
    return db.transactions.orderBy('date').reverse().toArray()
  },

  getById(id: number) {
    return db.transactions.get(id)
  },

  async getFiltered(filters: TransactionFilters) {
    let collection = db.transactions.orderBy('date').reverse()

    const results = await collection.toArray()

    return results.filter((tx) => {
      if (filters.type && tx.type !== filters.type) return false
      if (filters.categoryId !== undefined && tx.categoryId !== filters.categoryId) return false
      if (filters.accountId !== undefined && tx.accountId !== filters.accountId) return false
      if (filters.creditCardId !== undefined && tx.creditCardId !== filters.creditCardId) return false
      if (filters.from && tx.date < filters.from) return false
      if (filters.to && tx.date > filters.to) return false
      return true
    })
  },

  getByPeriod(year: number, month: number) {
    const from = new Date(year, month - 1, 1)
    const to = new Date(year, month, 0, 23, 59, 59, 999)
    return db.transactions.where('date').between(from, to, true, true).toArray()
  },

  getByCreditCard(creditCardId: number, from: Date, to: Date) {
    return db.transactions
      .where('creditCardId')
      .equals(creditCardId)
      .and((tx) => tx.date >= from && tx.date <= to)
      .toArray()
  },

  create(data: Omit<Transaction, 'id' | 'createdAt'>) {
    return db.transactions.add({ ...data, createdAt: new Date() })
  },

  update(id: number, data: Partial<Omit<Transaction, 'id' | 'createdAt'>>) {
    return db.transactions.update(id, data)
  },

  remove(id: number) {
    return db.transactions.delete(id)
  },
}
