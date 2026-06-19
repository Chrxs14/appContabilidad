import { db } from './db'
import type { Account, Category } from './types'

const DEFAULT_ACCOUNT: Omit<Account, 'id'> = {
  name: 'Efectivo',
  type: 'cash',
  initialBalance: 0,
  isDefault: true,
  createdAt: new Date(),
}

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  // ── Income ─────────────────────────────────────────
  { name: 'Sueldo',          type: 'income',  color: '#22c55e', icon: 'Banknote',        isDefault: true, createdAt: new Date() },
  { name: 'Freelance',       type: 'income',  color: '#16a34a', icon: 'Laptop',          isDefault: true, createdAt: new Date() },
  { name: 'Inversiones',     type: 'income',  color: '#3b82f6', icon: 'TrendingUp',      isDefault: true, createdAt: new Date() },
  { name: 'Otros ingresos',  type: 'income',  color: '#6b7280', icon: 'CirclePlus',      isDefault: true, createdAt: new Date() },

  // ── Expense ────────────────────────────────────────
  { name: 'Comida',          type: 'expense', color: '#f97316', icon: 'UtensilsCrossed', isDefault: true, createdAt: new Date() },
  { name: 'Transporte',      type: 'expense', color: '#0ea5e9', icon: 'Car',             isDefault: true, createdAt: new Date() },
  { name: 'Servicios',       type: 'expense', color: '#eab308', icon: 'Zap',            isDefault: true, createdAt: new Date() },
  { name: 'Salud',           type: 'expense', color: '#ef4444', icon: 'Heart',          isDefault: true, createdAt: new Date() },
  { name: 'Ocio',            type: 'expense', color: '#a855f7', icon: 'Gamepad2',       isDefault: true, createdAt: new Date() },
  { name: 'Ropa y calzado',  type: 'expense', color: '#ec4899', icon: 'Shirt',          isDefault: true, createdAt: new Date() },
  { name: 'Educación',       type: 'expense', color: '#6366f1', icon: 'BookOpen',       isDefault: true, createdAt: new Date() },
  { name: 'Vivienda',        type: 'expense', color: '#b45309', icon: 'Home',           isDefault: true, createdAt: new Date() },
  { name: 'Tecnología',      type: 'expense', color: '#06b6d4', icon: 'Smartphone',     isDefault: true, createdAt: new Date() },
  { name: 'Otros gastos',    type: 'expense', color: '#9ca3af', icon: 'MoreHorizontal', isDefault: true, createdAt: new Date() },
]

export async function runSeed() {
  const accountCount = await db.accounts.count()
  if (accountCount > 0) return  // already seeded

  await db.transaction('rw', db.accounts, db.categories, async () => {
    await db.accounts.add(DEFAULT_ACCOUNT)
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
  })
}
