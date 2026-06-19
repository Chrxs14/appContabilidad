import { db } from './db'
import type { Debt, DebtPayment } from './types'

export const debtsRepo = {
  getAll() {
    return db.debts.orderBy('name').toArray()
  },

  getById(id: number) {
    return db.debts.get(id)
  },

  create(data: Omit<Debt, 'id' | 'createdAt'>) {
    return db.debts.add({ ...data, createdAt: new Date() })
  },

  update(id: number, data: Partial<Omit<Debt, 'id' | 'createdAt'>>) {
    return db.debts.update(id, data)
  },

  remove(id: number) {
    return db.debts.delete(id)
  },
}

export const debtPaymentsRepo = {
  getByDebt(debtId: number) {
    return db.debtPayments
      .where('debtId')
      .equals(debtId)
      .sortBy('date')
  },

  getById(id: number) {
    return db.debtPayments.get(id)
  },

  async create(data: Omit<DebtPayment, 'id' | 'createdAt'>) {
    const id = await db.debtPayments.add({ ...data, createdAt: new Date() })

    // Reduce the debt balance automatically
    const debt = await db.debts.get(data.debtId)
    if (debt) {
      const newBalance = Math.max(0, debt.currentBalance - data.amount)
      await db.debts.update(data.debtId, { currentBalance: newBalance })
    }
    return id
  },

  remove(id: number) {
    return db.debtPayments.delete(id)
  },
}
