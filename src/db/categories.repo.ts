import { db } from './db'
import type { Category, CategoryType } from './types'

export const categoriesRepo = {
  getAll() {
    return db.categories.orderBy('name').toArray()
  },

  getByType(type: CategoryType) {
    return db.categories.where('type').equals(type).sortBy('name')
  },

  getById(id: number) {
    return db.categories.get(id)
  },

  create(data: Omit<Category, 'id' | 'createdAt'>) {
    return db.categories.add({ ...data, createdAt: new Date() })
  },

  update(id: number, data: Partial<Omit<Category, 'id' | 'createdAt'>>) {
    return db.categories.update(id, data)
  },

  async remove(id: number) {
    const category = await db.categories.get(id)
    if (category?.isDefault) throw new Error('Las categorías predeterminadas no pueden eliminarse.')

    const usedInTransactions = await db.transactions.where('categoryId').equals(id).count()
    if (usedInTransactions > 0)
      throw new Error('La categoría tiene transacciones asociadas. Reasígnelas antes de eliminarla.')

    return db.categories.delete(id)
  },
}
