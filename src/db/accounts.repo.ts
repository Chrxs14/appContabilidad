import { db } from './db'
import type { Account } from './types'

export const accountsRepo = {
  getAll() {
    return db.accounts.orderBy('name').toArray()
  },

  getById(id: number) {
    return db.accounts.get(id)
  },

  getDefault() {
    return db.accounts.filter((a) => a.isDefault).first()
  },

  create(data: Omit<Account, 'id' | 'createdAt'>) {
    return db.accounts.add({ ...data, createdAt: new Date() })
  },

  update(id: number, data: Partial<Omit<Account, 'id' | 'createdAt'>>) {
    return db.accounts.update(id, data)
  },

  async remove(id: number) {
    const account = await db.accounts.get(id)
    if (account?.isDefault) throw new Error('La cuenta predeterminada no puede eliminarse.')
    const txCount = await db.transactions.where('accountId').equals(id).count()
    if (txCount > 0)
      throw new Error(`La cuenta tiene ${txCount} movimiento(s) asociado(s). Elimínalos o reasígnalos antes de borrar la cuenta.`)
    return db.accounts.delete(id)
  },
}
