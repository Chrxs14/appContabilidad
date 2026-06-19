import { db } from './db'
import type { Budget } from './types'

export const budgetsRepo = {
  getAll() {
    return db.budgets.toArray()
  },

  getByPeriod(year: number, month: number) {
    return db.budgets.where('[year+month]').equals([year, month]).toArray()
  },

  getById(id: number) {
    return db.budgets.get(id)
  },

  async getByCategory(categoryId: number, year: number, month: number) {
    return db.budgets
      .where('[year+month]')
      .equals([year, month])
      .and((b) => b.categoryId === categoryId)
      .first()
  },

  create(data: Omit<Budget, 'id' | 'createdAt'>) {
    return db.budgets.add({ ...data, createdAt: new Date() })
  },

  update(id: number, data: Partial<Omit<Budget, 'id' | 'createdAt'>>) {
    return db.budgets.update(id, data)
  },

  remove(id: number) {
    return db.budgets.delete(id)
  },

  async copyFromPreviousMonth(year: number, month: number) {
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const previous = await budgetsRepo.getByPeriod(prevYear, prevMonth)
    if (!previous.length) return 0

    const newBudgets = previous.map(({ categoryId, limitAmount }) => ({
      categoryId,
      limitAmount,
      month,
      year,
      createdAt: new Date(),
    }))
    await db.budgets.bulkAdd(newBudgets)
    return newBudgets.length
  },
}
