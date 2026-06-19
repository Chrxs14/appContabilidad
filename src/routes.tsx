import { createBrowserRouter } from 'react-router-dom'
import App from './App'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        lazy: () => import('./features/dashboard/DashboardPage'),
      },
      {
        path: 'transacciones',
        lazy: () => import('./features/transactions/TransactionsPage'),
      },
      {
        path: 'tarjetas',
        lazy: () => import('./features/cards/CardsPage'),
      },
      {
        path: 'presupuestos',
        lazy: () => import('./features/budgets/BudgetsPage'),
      },
      {
        path: 'deudas',
        lazy: () => import('./features/debts/DebtsPage'),
      },
      {
        path: 'categorias',
        lazy: () => import('./features/categories/CategoriesPage'),
      },
      {
        path: 'ajustes',
        lazy: () => import('./features/settings/SettingsPage'),
      },
    ],
  },
])

export default router
