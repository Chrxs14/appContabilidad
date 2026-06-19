import { db } from './db'
import type { CreditCard } from './types'

export const creditCardsRepo = {
  getAll() {
    return db.creditCards.orderBy('name').toArray()
  },

  getById(id: number) {
    return db.creditCards.get(id)
  },

  create(data: Omit<CreditCard, 'id' | 'createdAt'>) {
    return db.creditCards.add({ ...data, createdAt: new Date() })
  },

  update(id: number, data: Partial<Omit<CreditCard, 'id' | 'createdAt'>>) {
    return db.creditCards.update(id, data)
  },

  remove(id: number) {
    return db.creditCards.delete(id)
  },
}
