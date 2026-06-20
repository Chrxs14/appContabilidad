import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TransactionType } from '@/db/types'

export interface FilterState {
  type: TransactionType | undefined
  categoryId: number | undefined
  source: string | undefined   // "account:5" | "card:3" | undefined
  search: string
}

export const EMPTY_FILTERS: FilterState = {
  type: undefined,
  categoryId: undefined,
  source: undefined,
  search: '',
}

interface Props {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

export function FilterBar({ filters, onChange }: Props) {
  const categories = useLiveQuery(
    () => db.categories.where('type').equals(filters.type ?? 'expense').sortBy('name'),
    [filters.type],
  )
  const allCategories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])
  const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray(), [])
  const cards = useLiveQuery(() => db.creditCards.orderBy('name').toArray(), [])

  const activeCount = [
    filters.type,
    filters.categoryId,
    filters.source,
    filters.search,
  ].filter(Boolean).length

  const visibleCategories = filters.type ? categories : allCategories

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Type toggle */}
        <div className="flex rounded-md border border-border overflow-hidden shrink-0">
          {([undefined, 'income', 'expense'] as const).map((t) => (
            <button
              key={t ?? 'all'}
              onClick={() => onChange({ ...filters, type: t, categoryId: undefined })}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                filters.type === t
                  ? t === 'income'
                    ? 'bg-green-600 text-white'
                    : t === 'expense'
                      ? 'bg-red-500 text-white'
                      : 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t === undefined ? 'Todos' : t === 'income' ? 'Ingresos' : 'Egresos'}
            </button>
          ))}
        </div>

        {/* Category */}
        <Select
          items={[
            { value: '', label: 'Todas las categorías' },
            ...(visibleCategories?.map((c) => ({ value: String(c.id), label: c.name })) ?? []),
          ]}
          value={filters.categoryId?.toString() ?? ''}
          onValueChange={(v: string | null) =>
            onChange({ ...filters, categoryId: v ? Number(v) : undefined })
          }
        >
          <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas las categorías</SelectItem>
            {visibleCategories?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{ background: c.color }}
                  />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Account / Card */}
        <Select
          items={[
            { value: '', label: 'Todas las cuentas' },
            ...(accounts?.map((a) => ({ value: `account:${a.id}`, label: a.name })) ?? []),
            ...(cards?.map((c) => ({ value: `card:${c.id}`, label: `${c.name} (tarjeta)` })) ?? []),
          ]}
          value={filters.source ?? ''}
          onValueChange={(v: string | null) =>
            onChange({ ...filters, source: v || undefined })
          }
        >
          <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs">
            <SelectValue placeholder="Cuenta / Tarjeta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas las cuentas</SelectItem>
            {accounts?.map((a) => (
              <SelectItem key={`account:${a.id}`} value={`account:${a.id}`}>
                {a.name}
              </SelectItem>
            ))}
            {cards && cards.length > 0 && (
              <>
                {cards.map((c) => (
                  <SelectItem key={`card:${c.id}`} value={`card:${c.id}`}>
                    {c.name} (tarjeta)
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>

        {/* Search */}
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar por nota…"
          className="h-8 w-full sm:w-[180px] text-xs"
        />

        {/* Clear */}
        {activeCount > 0 && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕ Limpiar
            <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
              {activeCount}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
