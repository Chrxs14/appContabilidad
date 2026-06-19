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
import { getBillingPeriod } from '@/domain/billing-cycle'

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

    // v1 — initial schema
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

    // v3 — add billingYear+billingMonth compound index on transactions; backfill existing rows
    this.version(3).stores({
      transactions: '++id, type, date, categoryId, accountId, creditCardId, [billingYear+billingMonth]',
    }).upgrade(async (trans) => {
      const cards: CreditCard[] = await trans.table('creditCards').toArray()
      const cardMap = new Map(cards.map((c) => [c.id!, c]))

      await trans.table('transactions').toCollection().modify((tx: Record<string, unknown>) => {
        const txDate = new Date(tx['date'] as Date)
        const cardId = tx['creditCardId'] as number | undefined
        const card = cardId !== undefined ? cardMap.get(cardId) : undefined

        const { billingYear, billingMonth } = card
          ? getBillingPeriod(txDate, card.cutDay)
          : { billingYear: txDate.getFullYear(), billingMonth: txDate.getMonth() + 1 }

        tx['billingYear'] = billingYear
        tx['billingMonth'] = billingMonth
      })
    })

    // v4 — rename minimumPayment → installmentAmount on debts; default termMonths = 0
    this.version(4).upgrade(async (trans) => {
      await trans.table('debts').toCollection().modify((debt: Record<string, unknown>) => {
        if (debt['minimumPayment'] !== undefined && debt['installmentAmount'] === undefined) {
          debt['installmentAmount'] = debt['minimumPayment']
          delete debt['minimumPayment']
        }
        if (debt['termMonths'] === undefined || debt['termMonths'] === null) {
          debt['termMonths'] = 0
        }
      })
    })
  }
}

export const db = new AppDB()
