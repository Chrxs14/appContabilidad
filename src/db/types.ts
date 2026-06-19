export type AccountType = 'cash' | 'bank' | 'debit'
export type TransactionType = 'income' | 'expense'
export type CategoryType = 'income' | 'expense'
export type DebtType = 'credit_card' | 'loan'

export interface Account {
  id?: number
  name: string
  type: AccountType
  initialBalance: number
  isDefault: boolean   // true for "Efectivo"; cannot be deleted
  createdAt: Date
}

export interface CreditCard {
  id?: number
  name: string
  creditLimit: number
  cutDay: number       // 1–28 (safe for all months)
  paymentDays: number  // days after cut to pay
  annualRate: number   // annual interest rate %
  color?: string
  createdAt: Date
}

export interface Category {
  id?: number
  name: string
  type: CategoryType
  color: string
  icon: string         // lucide-react icon name, e.g. "Banknote"
  parentId?: number    // set for subcategories
  isDefault: boolean   // default categories cannot be deleted, only renamed
  createdAt: Date
}

export interface Transaction {
  id?: number
  amount: number
  type: TransactionType
  date: Date
  categoryId: number
  accountId?: number       // mutually exclusive with creditCardId
  creditCardId?: number
  note?: string
  isRecurring: boolean
  billingYear: number      // period this tx counts toward (may differ from date for credit cards)
  billingMonth: number     // 1–12
  createdAt: Date
}

export interface Budget {
  id?: number
  categoryId: number
  month: number    // 1–12
  year: number
  limitAmount: number
  createdAt: Date
}

export interface Debt {
  id?: number
  name: string
  type: DebtType
  currentBalance: number
  annualRate: number
  minimumPayment: number
  termMonths?: number
  creditCardId?: number   // optional link to a CreditCard record
  createdAt: Date
}

export interface DebtPayment {
  id?: number
  debtId: number
  amount: number
  date: Date
  note?: string
  createdAt: Date
}
