import { db } from './db'
import type { Reimbursement } from './types'

export const reimbursementsRepo = {
  create(data: Omit<Reimbursement, 'id' | 'createdAt'>) {
    return db.reimbursements.add({ ...data, createdAt: new Date() })
  },

  getByTransactionId(transactionId: number) {
    return db.reimbursements.where('transactionId').equals(transactionId).first()
  },

  getAll() {
    return db.reimbursements.toArray()
  },

  async getPending() {
    const all = await db.reimbursements.toArray()
    return all.filter((r) => !r.isPaid)
  },

  markAsPaid(id: number, paidDate: Date, incomeTransactionId?: number) {
    return db.reimbursements.update(id, {
      isPaid: true,
      paidDate,
      ...(incomeTransactionId !== undefined ? { incomeTransactionId } : {}),
    })
  },

  remove(id: number) {
    return db.reimbursements.delete(id)
  },

  removeByTransactionId(transactionId: number) {
    return db.reimbursements.where('transactionId').equals(transactionId).delete()
  },

  updateAmount(transactionId: number, amount: number) {
    return db.reimbursements.where('transactionId').equals(transactionId).modify({ amount })
  },

  updatePersonName(id: number, personName: string) {
    return db.reimbursements.update(id, { personName })
  },
}
