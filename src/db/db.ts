import Dexie, { type Table } from 'dexie'
import type {
  Account,
  CreditCard,
  Category,
  Transaction,
  Budget,
  Debt,
  DebtPayment,
} from './types'

class AppDB extends Dexie {
  accounts!: Table<Account, number>
  creditCards!: Table<CreditCard, number>
  categories!: Table<Category, number>
  transactions!: Table<Transaction, number>
  budgets!: Table<Budget, number>
  debts!: Table<Debt, number>
  debtPayments!: Table<DebtPayment, number>

  constructor() {
    super('AppContabilidad')

    // v1 — initial schema (name not indexed, kept for upgrade path)
    this.version(1).stores({
      accounts:     '++id, type, isDefault',
      creditCards:  '++id, cutDay',
      categories:   '++id, type, parentId, isDefault',
      transactions: '++id, type, date, categoryId, accountId, creditCardId',
      budgets:      '++id, categoryId, [year+month], year',
      debts:        '++id, type, creditCardId',
      debtPayments: '++id, debtId, date',
    })

    // v2 — add name index to stores that sort by name
    this.version(2).stores({
      accounts:    '++id, name, type, isDefault',
      creditCards: '++id, name, cutDay',
      categories:  '++id, name, type, parentId, isDefault',
      debts:       '++id, name, type, creditCardId',
    })
  }
}

export const db = new AppDB()
