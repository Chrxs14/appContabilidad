import { useUIStore } from '@/store/uiStore'
import { Input } from '@/components/ui/input'
import type { ServiceMode } from '@/db/types'
import { IVA_RATE } from '@/domain/bill-split'

interface Props {
  subtotal: number
  hasIVA: boolean
  onIVAChange: (v: boolean) => void
  hasServiceCharge: boolean
  onServiceChargeChange: (v: boolean) => void
  serviceMode: ServiceMode
  onServiceModeChange: (v: ServiceMode) => void
  serviceValue: number
  onServiceValueChange: (v: number) => void
}

export function TaxPanel({
  subtotal,
  hasIVA,
  onIVAChange,
  hasServiceCharge,
  onServiceChargeChange,
  serviceMode,
  onServiceModeChange,
  serviceValue,
  onServiceValueChange,
}: Props) {
  const { formatAmount } = useUIStore()

  const ivaAmount = hasIVA ? subtotal * IVA_RATE : 0
  const serviceAmount = hasServiceCharge
    ? serviceMode === 'percent'
      ? subtotal * serviceValue / 100
      : serviceValue
    : 0
  const grandTotal = subtotal + ivaAmount + serviceAmount

  return (
    <div className="space-y-4">
      {/* IVA */}
      <div className="rounded-md border px-4 py-3 space-y-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={hasIVA}
            onChange={(e) => onIVAChange(e.target.checked)}
          />
          <span className="text-sm font-medium">Incluye IVA (15%)</span>
        </label>
        {hasIVA && (
          <p className="pl-6 text-xs text-muted-foreground tabular-nums">
            IVA: {formatAmount(ivaAmount)}
          </p>
        )}
      </div>

      {/* Servicio */}
      <div className="rounded-md border px-4 py-3 space-y-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={hasServiceCharge}
            onChange={(e) => onServiceChargeChange(e.target.checked)}
          />
          <span className="text-sm font-medium">Incluye cargo por servicio</span>
        </label>

        {hasServiceCharge && (
          <div className="pl-6 space-y-2">
            {/* mode radio */}
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="serviceMode"
                  value="percent"
                  checked={serviceMode === 'percent'}
                  onChange={() => onServiceModeChange('percent')}
                  className="accent-primary"
                />
                Porcentaje
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="serviceMode"
                  value="fixed"
                  checked={serviceMode === 'fixed'}
                  onChange={() => onServiceModeChange('fixed')}
                  className="accent-primary"
                />
                Valor fijo
              </label>
            </div>

            {/* value input */}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={serviceMode === 'percent' ? '1' : '0.01'}
                placeholder={serviceMode === 'percent' ? 'Ej: 10' : 'Ej: 5.00'}
                value={serviceValue || ''}
                onChange={(e) => onServiceValueChange(parseFloat(e.target.value) || 0)}
                className="h-8 w-32 text-sm"
              />
              <span className="text-sm text-muted-foreground">
                {serviceMode === 'percent' ? '%' : '$'}
              </span>
            </div>

            {serviceAmount > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Servicio: {formatAmount(serviceAmount)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Preview total */}
      {(hasIVA || hasServiceCharge) && subtotal > 0 && (
        <div className="rounded-md bg-muted/40 px-4 py-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatAmount(subtotal)}</span>
          </div>
          {hasServiceCharge && serviceAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Servicio</span>
              <span className="tabular-nums">{formatAmount(serviceAmount)}</span>
            </div>
          )}
          {hasIVA && (
            <div className="flex justify-between text-muted-foreground">
              <span>IVA (15%)</span>
              <span className="tabular-nums">{formatAmount(ivaAmount)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t pt-1 font-medium">
            <span>Total estimado</span>
            <span className="tabular-nums">{formatAmount(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
