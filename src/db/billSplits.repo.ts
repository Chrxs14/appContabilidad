import { db } from './db'
import { billItemsRepo } from './billItems.repo'
import type { BillSplit } from './types'

export const billSplitsRepo = {
  create(data: Omit<BillSplit, 'id' | 'createdAt'>) {
    return db.billSplits.add({ ...data, createdAt: new Date() })
  },

  update(id: number, data: Partial<Omit<BillSplit, 'id' | 'createdAt'>>) {
    return db.billSplits.update(id, data)
  },

  async remove(id: number) {
    await billItemsRepo.removeByBillSplit(id)
    return db.billSplits.delete(id)
  },

  getAll() {
    return db.billSplits.orderBy('date').reverse().toArray()
  },

  async getById(id: number) {
    return db.billSplits.get(id)
  },
}
