import { useState } from 'react'
import { useUIStore } from '@/store/uiStore'
import { simulatePayoff, calcConsolidatedDebt } from '@/domain/debt'
import type { Debt } from '@/db/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  debts: Debt[]
}

function yearsMonths(months: number): string {
  if (!isFinite(months)) return 'No se puede liquidar'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m} mes${m !== 1 ? 'es' : ''}`
  if (m === 0) return `${y} año${y !== 1 ? 's' : ''}`
  return `${y} año${y !== 1 ? 's' : ''} y ${m} mes${m !== 1 ? 'es' : ''}`
}

export function PayoffSimulator({ debts }: Props) {
  const { formatAmount } = useUIStore()
  const consolidated = calcConsolidatedDebt(debts)
  const [budget, setBudget] = useState(consolidated.totalInstallmentAmount)

  const isValid = budget >= consolidated.totalInstallmentAmount && debts.length > 0

  const snowball = isValid ? simulatePayoff(debts, budget, 'snowball') : null
  const avalanche = isValid ? simulatePayoff(debts, budget, 'avalanche') : null

  const extra = budget - consolidated.totalInstallmentAmount

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Simulador de liquidación
      </p>

      <div className="space-y-1">
        <Label htmlFor="sim-budget">Presupuesto mensual para deudas</Label>
        <Input
          id="sim-budget"
          type="number"
          step="0.01"
          min={consolidated.totalInstallmentAmount}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="max-w-[200px]"
        />
        <p className="text-xs text-muted-foreground">
          Mínimo requerido: {formatAmount(consolidated.totalInstallmentAmount)}
          {extra > 0 && (
            <span className="ml-2 text-green-600 dark:text-green-400">
              (+{formatAmount(extra)} extra)
            </span>
          )}
        </p>
        {!isValid && (
          <p className="text-xs text-destructive">
            El presupuesto debe ser al menos {formatAmount(consolidated.totalInstallmentAmount)} para cubrir los pagos mínimos.
          </p>
        )}
      </div>

      {isValid && snowball && avalanche && (
        <div className="grid grid-cols-2 gap-4">
          {/* Snowball */}
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide">Bola de nieve</p>
            <p className="text-[11px] text-muted-foreground">Paga primero la deuda más pequeña</p>
            <div className="space-y-1">
              <p className="text-lg font-bold tabular-nums">{yearsMonths(snowball.months)}</p>
              <p className="text-xs text-muted-foreground">
                Interés total:{' '}
                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                  {formatAmount(snowball.totalInterestPaid)}
                </span>
              </p>
            </div>
            <div className="space-y-0.5 pt-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Orden de pago
              </p>
              {snowball.payoffOrder.map((item, i) => (
                <p key={item.debtId} className="text-xs">
                  {i + 1}. {item.name}{' '}
                  <span className="text-muted-foreground">({yearsMonths(item.monthPaidOff)})</span>
                </p>
              ))}
            </div>
          </div>

          {/* Avalanche */}
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide">Avalancha</p>
            <p className="text-[11px] text-muted-foreground">Paga primero la tasa más alta</p>
            <div className="space-y-1">
              <p className="text-lg font-bold tabular-nums">{yearsMonths(avalanche.months)}</p>
              <p className="text-xs text-muted-foreground">
                Interés total:{' '}
                <span className="font-medium text-yellow-600 dark:text-yellow-400">
                  {formatAmount(avalanche.totalInterestPaid)}
                </span>
              </p>
            </div>
            <div className="space-y-0.5 pt-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Orden de pago
              </p>
              {avalanche.payoffOrder.map((item, i) => (
                <p key={item.debtId} className="text-xs">
                  {i + 1}. {item.name}{' '}
                  <span className="text-muted-foreground">({yearsMonths(item.monthPaidOff)})</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {isValid && avalanche && snowball && avalanche.totalInterestPaid < snowball.totalInterestPaid && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-300">
          La estrategia Avalancha te ahorra{' '}
          <strong>{formatAmount(snowball.totalInterestPaid - avalanche.totalInterestPaid)}</strong> en intereses.
        </p>
      )}
    </div>
  )
}
