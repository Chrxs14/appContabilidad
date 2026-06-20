import { useUIStore } from '@/store/uiStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface DraftItem {
  key: string
  name: string
  unitPrice: number
  quantity: number
  assignedTo: string[]
}

interface Props {
  items: DraftItem[]
  onChange: (items: DraftItem[]) => void
}

function newItem(): DraftItem {
  return { key: crypto.randomUUID(), name: '', unitPrice: 0, quantity: 1, assignedTo: [] }
}

export function ItemsEditor({ items, onChange }: Props) {
  const { formatAmount } = useUIStore()

  function update(key: string, patch: Partial<DraftItem>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  function remove(key: string) {
    onChange(items.filter((item) => item.key !== key))
  }

  function add() {
    onChange([...items, newItem()])
  }

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-2 font-medium">Descripción</th>
                <th className="pb-2 pr-2 w-16 font-medium text-center">Cant.</th>
                <th className="pb-2 pr-2 w-28 font-medium text-right">Precio unit.</th>
                <th className="pb-2 pr-2 w-24 font-medium text-right">Total</th>
                <th className="pb-2 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.key}>
                  <td className="py-2 pr-2">
                    <Input
                      placeholder="Nombre del item"
                      value={item.name}
                      onChange={(e) => update(item.key, { name: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        update(item.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="h-8 w-16 text-center text-sm"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={item.unitPrice || ''}
                      onChange={(e) =>
                        update(item.key, { unitPrice: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 w-28 text-right text-sm"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {formatAmount(item.unitPrice * item.quantity)}
                  </td>
                  <td className="py-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(item.key)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full">
        + Agregar item
      </Button>

      {items.length > 0 && (
        <div className="flex justify-between border-t pt-2 text-sm font-medium">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatAmount(subtotal)}</span>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-2">
          Agrega los items de la factura.
        </p>
      )}
    </div>
  )
}
