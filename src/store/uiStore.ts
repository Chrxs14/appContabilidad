import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getCurrentPeriod, type Period } from '@/lib/dates'
import { createCurrencyFormatter } from '@/lib/money'

export type Theme = 'light' | 'dark' | 'system'

interface UIState {
  // Active period (used for filtering across the app)
  activePeriod: Period
  setActivePeriod: (period: Period) => void

  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void

  // Currency / locale
  currency: string
  locale: string
  setCurrency: (currency: string, locale: string) => void

  // Derived helper (not persisted)
  formatAmount: (amount: number) => string
}

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activePeriod: getCurrentPeriod(),
      setActivePeriod: (activePeriod) => set({ activePeriod }),

      theme: 'system',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },

      currency: 'USD',
      locale: 'en-US',
      setCurrency: (currency, locale) => {
        set({ currency, locale, formatAmount: createCurrencyFormatter(currency, locale) })
      },

      formatAmount: createCurrencyFormatter('USD', 'en-US'),
    }),
    {
      name: 'app-contabilidad-ui',
      // Only persist user preferences, not the derived formatter
      partialize: (state) => ({
        theme: state.theme,
        currency: state.currency,
        locale: state.locale,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Re-apply theme on page reload
        applyTheme(state.theme)
        // Rebuild formatter with persisted currency/locale
        state.formatAmount = createCurrencyFormatter(state.currency, state.locale)
      },
    },
  ),
)
