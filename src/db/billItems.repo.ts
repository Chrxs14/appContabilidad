import { db } from './db'
import type { BillItem } from './types'

export const billItemsRepo = {
  create(data: Omit<BillItem, 'id' | 'createdAt'>) {
    return db.billItems.add({ ...data, createdAt: new Date() })
  },

  update(id: number, data: Partial<Omit<BillItem, 'id' | 'createdAt'>>) {
    return db.billItems.update(id, data)
  },

  remove(id: number) {
    return db.billItems.delete(id)
  },

  getByBillSplit(billSplitId: number) {
    return db.billItems.where('billSplitId').equals(billSplitId).sortBy('createdAt')
  },

  async replaceAll(
    billSplitId: number,
    items: Omit<BillItem, 'id' | 'createdAt' | 'billSplitId'>[],
  ) {
    await db.transaction('rw', db.billItems, async () => {
      await db.billItems.where('billSplitId').equals(billSplitId).delete()
      const now = new Date()
      await db.billItems.bulkAdd(
        items.map((item) => ({ ...item, billSplitId, createdAt: now })),
      )
    })
  },

  removeByBillSplit(billSplitId: number) {
    return db.billItems.where('billSplitId').equals(billSplitId).delete()
  },
}
