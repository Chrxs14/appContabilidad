import { useState } from 'react'
import { billSplitsRepo, billItemsRepo } from '@/db'
import type { SplitMode, ServiceMode } from '@/db/types'
import type { SplitInput } from '@/domain/bill-split'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PeopleEditor } from './components/PeopleEditor'
import { ItemsEditor, type DraftItem } from './components/ItemsEditor'
import { TaxPanel } from './components/TaxPanel'
import { ItemAssigner } from './components/ItemAssigner'
import { SplitResult } from './components/SplitResult'

const STEPS = [
  'Datos generales',
  'Items',
  'Impuestos',
  'Modo de división',
  'Resultado',
] as const

interface Props {
  onDone: () => void
  onCancel: () => void
}

export function SplitWizard({ onDone, onCancel }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // ── step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0)

  // ── step 1 ────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today)
  const [isGrouped, setIsGrouped] = useState(false)
  const [people, setPeople] = useState<string[]>([])

  // ── step 2 ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<DraftItem[]>([])

  // ── step 3 ────────────────────────────────────────────────────────────────
  const [hasIVA, setHasIVA] = useState(false)
  const [hasServiceCharge, setHasServiceCharge] = useState(false)
  const [serviceMode, setServiceMode] = useState<ServiceMode>('percent')
  const [serviceValue, setServiceValue] = useState(0)

  // ── step 4 ────────────────────────────────────────────────────────────────
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')

  // ── save ──────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)

  // ── validation ────────────────────────────────────────────────────────────
  function canAdvance(): boolean {
    if (step === 0) return !isGrouped || people.length >= 2
    if (step === 1) return (
      items.length > 0 &&
      items.every((i) => i.name.trim().length > 0 && i.unitPrice > 0 && i.quantity >= 1)
    )
    if (step === 2) return !hasServiceCharge || serviceValue > 0
    return true
  }

  function errorMessage(): string | null {
    if (step === 0 && isGrouped && people.length < 2)
      return 'Agrega al menos 2 personas.'
    if (step === 1 && items.length === 0)
      return 'Agrega al menos un item.'
    if (step === 1 && !items.every((i) => i.name.trim() && i.unitPrice > 0))
      return 'Todos los items deben tener nombre y precio mayor a 0.'
    if (step === 2 && hasServiceCharge && serviceValue <= 0)
      return 'Ingresa el valor del cargo por servicio.'
    return null
  }

  // ── splitInput for steps 4 & 5 ────────────────────────────────────────────
  const splitInput: SplitInput = {
    people: isGrouped ? people : [],
    items: items.map(({ name, unitPrice, quantity, assignedTo }) => ({
      name, unitPrice, quantity, assignedTo,
    })),
    hasIVA,
    hasServiceCharge,
    serviceMode,
    serviceValue,
    splitMode,
  }

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)

  // ── save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const splitId = await billSplitsRepo.create({
        title: title.trim(),
        date: new Date(date + 'T12:00:00'),
        people: isGrouped ? people : [],
        hasIVA,
        hasServiceCharge,
        serviceMode,
        serviceValue,
        splitMode,
      })
      await billItemsRepo.replaceAll(
        splitId,
        items.map(({ name, unitPrice, quantity, assignedTo }) => ({
          name, unitPrice, quantity, assignedTo,
        })),
      )
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          ← Cancelar
        </button>
        <h2 className="text-lg font-semibold">Nueva división</h2>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Paso {step + 1} de {STEPS.length} — {STEPS[step]}
      </p>

      {/* ── Step 0: Datos generales ────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Nombre (opcional)</Label>
            <Input
              id="title"
              placeholder="Ej: Cena cumpleaños"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-3 rounded-md border border-dashed px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={isGrouped}
                onChange={(e) => setIsGrouped(e.target.checked)}
              />
              <span className="text-sm font-medium">Consumo grupal</span>
            </label>

            {isGrouped && (
              <PeopleEditor people={people} onChange={setPeople} />
            )}
          </div>
        </div>
      )}

      {/* ── Step 1: Items ─────────────────────────────────────────────── */}
      {step === 1 && (
        <ItemsEditor items={items} onChange={setItems} />
      )}

      {/* ── Step 2: Impuestos ─────────────────────────────────────────── */}
      {step === 2 && (
        <TaxPanel
          subtotal={subtotal}
          hasIVA={hasIVA}
          onIVAChange={setHasIVA}
          hasServiceCharge={hasServiceCharge}
          onServiceChargeChange={setHasServiceCharge}
          serviceMode={serviceMode}
          onServiceModeChange={setServiceMode}
          serviceValue={serviceValue}
          onServiceValueChange={setServiceValue}
        />
      )}

      {/* ── Step 3: Modo de división ───────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3">
              <input
                type="radio"
                name="splitMode"
                value="equal"
                checked={splitMode === 'equal'}
                onChange={() => setSplitMode('equal')}
                className="mt-0.5 accent-primary"
              />
              <div>
                <p className="text-sm font-medium">División equitativa</p>
                <p className="text-xs text-muted-foreground">
                  El total se divide en partes iguales entre todas las personas.
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3">
              <input
                type="radio"
                name="splitMode"
                value="by_consumption"
                checked={splitMode === 'by_consumption'}
                onChange={() => setSplitMode('by_consumption')}
                className="mt-0.5 accent-primary"
                disabled={!isGrouped || people.length === 0}
              />
              <div>
                <p className={`text-sm font-medium ${!isGrouped || people.length === 0 ? 'text-muted-foreground' : ''}`}>
                  División por consumo
                </p>
                <p className="text-xs text-muted-foreground">
                  Cada item se asigna a quien lo consumió.
                  {(!isGrouped || people.length === 0) && ' (Requiere modo grupal con personas.)'}
                </p>
              </div>
            </label>
          </div>

          {splitMode === 'by_consumption' && isGrouped && people.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">¿Quién consumió cada item?</p>
              <ItemAssigner items={items} people={people} onChange={setItems} />
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Resultado ─────────────────────────────────────────── */}
      {step === 4 && (
        <SplitResult input={splitInput} onSave={handleSave} saving={saving} />
      )}

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Atrás
          </Button>

          <div className="flex flex-col items-end gap-1">
            {errorMessage() && (
              <p className="text-xs text-destructive">{errorMessage()}</p>
            )}
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
            >
              {step === 3 ? 'Ver resultado' : 'Continuar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
