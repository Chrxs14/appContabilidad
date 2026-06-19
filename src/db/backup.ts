import { z } from 'zod'
import { db } from './db'

const BACKUP_VERSION = 1

// ── Zod schemas for import validation ────────────────────────────────────────

const accountSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  type: z.enum(['cash', 'bank', 'debit']),
  initialBalance: z.number(),
  isDefault: z.boolean(),
  createdAt: z.coerce.date(),
})

const creditCardSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  creditLimit: z.number(),
  cutDay: z.number().min(1).max(28),
  paymentDays: z.number().min(0),
  annualRate: z.number().min(0),
  color: z.string().optional(),
  createdAt: z.coerce.date(),
})

const categorySchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  type: z.enum(['income', 'expense']),
  color: z.string(),
  icon: z.string(),
  parentId: z.number().optional(),
  isDefault: z.boolean(),
  createdAt: z.coerce.date(),
})

const transactionSchema = z.object({
  id: z.number().optional(),
  amount: z.number(),
  type: z.enum(['income', 'expense']),
  date: z.coerce.date(),
  categoryId: z.number(),
  accountId: z.number().optional(),
  creditCardId: z.number().optional(),
  note: z.string().optional(),
  isRecurring: z.boolean(),
  createdAt: z.coerce.date(),
})

const budgetSchema = z.object({
  id: z.number().optional(),
  categoryId: z.number(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000),
  limitAmount: z.number().min(0),
  createdAt: z.coerce.date(),
})

const debtSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  type: z.enum(['credit_card', 'loan']),
  currentBalance: z.number().min(0),
  annualRate: z.number().min(0),
  minimumPayment: z.number().min(0),
  termMonths: z.number().optional(),
  creditCardId: z.number().optional(),
  createdAt: z.coerce.date(),
})

const debtPaymentSchema = z.object({
  id: z.number().optional(),
  debtId: z.number(),
  amount: z.number().min(0),
  date: z.coerce.date(),
  note: z.string().optional(),
  createdAt: z.coerce.date(),
})

const backupSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  data: z.object({
    accounts:     z.array(accountSchema),
    creditCards:  z.array(creditCardSchema),
    categories:   z.array(categorySchema),
    transactions: z.array(transactionSchema),
    budgets:      z.array(budgetSchema),
    debts:        z.array(debtSchema),
    debtPayments: z.array(debtPaymentSchema),
  }),
})

type BackupFile = z.infer<typeof backupSchema>

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportBackup(): Promise<void> {
  const [accounts, creditCards, categories, transactions, budgets, debts, debtPayments] =
    await Promise.all([
      db.accounts.toArray(),
      db.creditCards.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.debts.toArray(),
      db.debtPayments.toArray(),
    ])

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { accounts, creditCards, categories, transactions, budgets, debts, debtPayments },
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Import ────────────────────────────────────────────────────────────────────

export type ImportMode = 'replace' | 'merge'

export async function importBackup(file: File, mode: ImportMode = 'replace'): Promise<void> {
  const text = await file.text()
  const raw = JSON.parse(text) as unknown

  const result = backupSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Archivo de respaldo inválido: ${result.error.message}`)
  }

  const { data } = result.data

  await db.transaction(
    'rw',
    [db.accounts, db.creditCards, db.categories, db.transactions, db.budgets, db.debts, db.debtPayments],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.accounts.clear(),
          db.creditCards.clear(),
          db.categories.clear(),
          db.transactions.clear(),
          db.budgets.clear(),
          db.debts.clear(),
          db.debtPayments.clear(),
        ])
      }

      await db.accounts.bulkPut(data.accounts)
      await db.creditCards.bulkPut(data.creditCards)
      await db.categories.bulkPut(data.categories)
      await db.transactions.bulkPut(data.transactions)
      await db.budgets.bulkPut(data.budgets)
      await db.debts.bulkPut(data.debts)
      await db.debtPayments.bulkPut(data.debtPayments)
    },
  )
}
