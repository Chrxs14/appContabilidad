import { db } from './db'
import type { Transaction, TransactionType } from './types'
import { getBillingPeriod } from '@/domain/billing-cycle'
import { reimbursementsRepo } from './reimbursements.repo'

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

  async create(data: Omit<Transaction, 'id' | 'createdAt' | 'billingYear' | 'billingMonth'>) {
    let billingYear = data.date.getFullYear()
    let billingMonth = data.date.getMonth() + 1

    if (data.creditCardId) {
      const card = await db.creditCards.get(data.creditCardId)
      if (card) {
        ;({ billingYear, billingMonth } = getBillingPeriod(data.date, card.cutDay))
      }
    }

    return db.transactions.add({ ...data, billingYear, billingMonth, createdAt: new Date() })
  },

  async update(id: number, data: Partial<Omit<Transaction, 'id' | 'createdAt'>>) {
    if (data.amount !== undefined) {
      await reimbursementsRepo.updateAmount(id, data.amount)
    }

    if (data.date !== undefined || data.creditCardId !== undefined) {
      const existing = await db.transactions.get(id)
      if (existing) {
        const txDate = data.date ?? existing.date
        const cardId = 'creditCardId' in data ? data.creditCardId : existing.creditCardId

        let billingYear = txDate.getFullYear()
        let billingMonth = txDate.getMonth() + 1

        if (cardId) {
          const card = await db.creditCards.get(cardId)
          if (card) {
            ;({ billingYear, billingMonth } = getBillingPeriod(txDate, card.cutDay))
          }
        }

        return db.transactions.update(id, { ...data, billingYear, billingMonth })
      }
    }
    return db.transactions.update(id, data)
  },

  async remove(id: number) {
    await reimbursementsRepo.removeByTransactionId(id)
    return db.transactions.delete(id)
  },
}
