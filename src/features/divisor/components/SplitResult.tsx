import { useMemo } from 'react'
import { useUIStore } from '@/store/uiStore'
import { splitBill } from '@/domain/bill-split'
import type { SplitInput, SplitResult as Result } from '@/domain/bill-split'

interface Props {
  input: SplitInput
  onSave: () => Promise<void>
  saving: boolean
}

export function SplitResult({ input, onSave, saving }: Props) {
  const { formatAmount } = useUIStore()

  const result: Result = useMemo(() => splitBill(input), [input])

  const showService = input.hasServiceCharge && result.serviceAmount > 0
  const showIVA = input.hasIVA
  const byConsumption = input.splitMode === 'by_consumption'

  return (
    <div className="space-y-5">
      {/* Resumen general */}
      <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatAmount(result.subtotal)}</span>
        </div>
        {showService && (
          <div className="flex justify-between text-muted-foreground">
            <span>
              Servicio{' '}
              {input.serviceMode === 'percent' ? `(${input.serviceValue}%)` : '(fijo)'}
            </span>
            <span className="tabular-nums">{formatAmount(result.serviceAmount)}</span>
          </div>
        )}
        {showIVA && (
          <div className="flex justify-between text-muted-foreground">
            <span>IVA (15%)</span>
            <span className="tabular-nums">{formatAmount(result.ivaAmount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-1.5 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatAmount(result.grandTotal)}</span>
        </div>
      </div>

      {/* Por persona */}
      {result.perPerson.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Por persona
          </p>
          <div className="divide-y rounded-lg border">
            {result.perPerson.map((person) => (
              <div key={person.name} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{person.name}</span>
                  <span className="tabular-nums font-semibold">
                    {formatAmount(person.total)}
                  </span>
                </div>
                {byConsumption && (
                  <div className="text-xs text-muted-foreground space-y-0.5 pl-0">
                    <div className="flex justify-between">
                      <span>Consumo</span>
                      <span className="tabular-nums">{formatAmount(person.itemsSubtotal)}</span>
                    </div>
                    {showService && (
                      <div className="flex justify-between">
                        <span>Servicio</span>
                        <span className="tabular-nums">{formatAmount(person.serviceShare)}</span>
                      </div>
                    )}
                    {showIVA && (
                      <div className="flex justify-between">
                        <span>IVA</span>
                        <span className="tabular-nums">{formatAmount(person.ivaShare)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones */}
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Guardando…' : 'Guardar división'}
      </button>
    </div>
  )
}
