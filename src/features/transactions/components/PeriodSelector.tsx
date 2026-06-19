import { useUIStore } from '@/store/uiStore'
import { formatMonthYear, prevPeriod, nextPeriod } from '@/lib/dates'

export function PeriodSelector() {
  const { activePeriod, setActivePeriod } = useUIStore()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setActivePeriod(prevPeriod(activePeriod))}
        className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Mes anterior"
      >
        ‹
      </button>
      <span className="min-w-[140px] text-center text-sm font-medium capitalize">
        {formatMonthYear(activePeriod)}
      </span>
      <button
        onClick={() => setActivePeriod(nextPeriod(activePeriod))}
        className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground hover:bg-muted transition-colors"
        aria-label="Mes siguiente"
      >
        ›
      </button>
    </div>
  )
}
