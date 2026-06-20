import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useUIStore, type Theme } from '@/store/uiStore'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transacciones', label: 'Transacciones' },
  { to: '/tarjetas', label: 'Tarjetas' },
  { to: '/presupuestos', label: 'Presupuestos' },
  { to: '/deudas', label: 'Deudas' },
  { to: '/cobros', label: 'Cobros' },
  { to: '/categorias', label: 'Categorías' },
  { to: '/ajustes', label: 'Ajustes' },
]

const THEME_ICONS: Record<Theme, string> = { light: '☀', dark: '☾', system: '⊙' }
const THEME_CYCLE: Theme[] = ['light', 'dark', 'system']

export default function App() {
  const { theme, setTheme } = useUIStore()
  const [menuOpen, setMenuOpen] = useState(false)

  function cycleTheme() {
    const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length]!
    setTheme(next)
  }

  return (
    <div className="flex min-h-svh">
      {/* ── Mobile header ── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
        <p className="text-sm font-semibold text-sidebar-foreground/60 uppercase tracking-widest">
          Finanzas
        </p>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label="Menú"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* ── Overlay for mobile menu ── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-20 flex w-56 shrink-0 flex-col border-r border-border bg-sidebar transition-transform duration-200
          md:static md:translate-x-0
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between p-4 pb-2 pt-4 md:pt-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-sidebar-foreground/60">
            Finanzas
          </p>
          <button
            onClick={cycleTheme}
            title={`Tema: ${theme}`}
            className="rounded-md px-1.5 py-0.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
          >
            {THEME_ICONS[theme]}
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-2 py-2 flex-1">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto p-4 pt-16 md:p-6 md:pt-6">
        <Outlet />
      </main>
    </div>
  )
}
