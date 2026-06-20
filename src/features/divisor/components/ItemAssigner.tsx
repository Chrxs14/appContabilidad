import { useUIStore } from '@/store/uiStore'
import type { DraftItem } from './ItemsEditor'

interface Props {
  items: DraftItem[]
  people: string[]
  onChange: (items: DraftItem[]) => void
}

export function ItemAssigner({ items, people, onChange }: Props) {
  const { formatAmount } = useUIStore()

  function togglePerson(itemKey: string, person: string) {
    onChange(
      items.map((item) => {
        if (item.key !== itemKey) return item
        const has = item.assignedTo.includes(person)
        const assignedTo = has
          ? item.assignedTo.filter((p) => p !== person)
          : [...item.assignedTo, person]
        return { ...item, assignedTo }
      }),
    )
  }

  function setAll(itemKey: string) {
    onChange(items.map((item) => (item.key === itemKey ? { ...item, assignedTo: [] } : item)))
  }

  if (items.length === 0 || people.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Selecciona quién consumió cada item. Si nadie está seleccionado, se divide entre todos.
      </p>

      {items.map((item) => {
        const isAll = item.assignedTo.length === 0
        const itemTotal = item.unitPrice * item.quantity

        return (
          <div key={item.key} className="rounded-md border px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate pr-2">
                {item.name || 'Sin nombre'}
              </span>
              <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                {formatAmount(itemTotal)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Todos chip */}
              <button
                type="button"
                onClick={() => setAll(item.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isAll
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                Todos
              </button>

              {people.map((person) => {
                const selected = item.assignedTo.includes(person)
                return (
                  <button
                    key={person}
                    type="button"
                    onClick={() => togglePerson(item.key, person)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {person}
                    {selected && item.assignedTo.length > 1 && (
                      <span className="ml-1 opacity-70">
                        ({formatAmount(itemTotal / item.assignedTo.length)})
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {isAll && people.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Se divide entre todos · {formatAmount(itemTotal / people.length)} c/u
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
