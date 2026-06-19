import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { creditCardsRepo } from '@/db'
import type { CreditCard } from '@/db/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PRESET_COLORS = [
  '#22c55e', '#16a34a', '#3b82f6', '#0ea5e9', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#eab308', '#06b6d4',
  '#6366f1', '#b45309', '#9ca3af', '#6b7280',
]

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  creditLimit: z.number().positive('El límite debe ser mayor a 0'),
  cutDay: z.number().int().min(1, 'Mínimo día 1').max(28, 'Máximo día 28'),
  paymentDays: z.number().int().min(1, 'Debe ser al menos 1 día'),
  annualRate: z.number().min(0, 'La tasa no puede ser negativa'),
  color: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

interface Props {
  editing?: CreditCard
  onSuccess?: () => void
  onCancel?: () => void
}

export function CardForm({ editing, onSuccess, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          name: editing.name,
          creditLimit: editing.creditLimit,
          cutDay: editing.cutDay,
          paymentDays: editing.paymentDays,
          annualRate: editing.annualRate,
          color: editing.color ?? PRESET_COLORS[2]!,
        }
      : {
          cutDay: 15,
          paymentDays: 20,
          annualRate: 0,
          color: PRESET_COLORS[2]!,
        },
  })

  const selectedColor = watch('color')

  async function onSubmit(values: FormValues) {
    if (editing?.id) {
      await creditCardsRepo.update(editing.id, values)
    } else {
      await creditCardsRepo.create(values)
    }
    reset()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" placeholder="Ej. BBVA Azul" {...register('name')} />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="creditLimit">Límite de crédito</Label>
        <Input
          id="creditLimit"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('creditLimit', { valueAsNumber: true })}
        />
        {errors.creditLimit && (
          <p className="text-destructive text-xs">{errors.creditLimit.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="cutDay">Día de corte</Label>
          <Input
            id="cutDay"
            type="number"
            min="1"
            max="28"
            {...register('cutDay', { valueAsNumber: true })}
          />
          {errors.cutDay && (
            <p className="text-destructive text-xs">{errors.cutDay.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="paymentDays">Días para pagar (tras corte)</Label>
          <Input
            id="paymentDays"
            type="number"
            min="1"
            {...register('paymentDays', { valueAsNumber: true })}
          />
          {errors.paymentDays && (
            <p className="text-destructive text-xs">{errors.paymentDays.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="annualRate">Tasa de interés anual (%)</Label>
        <Input
          id="annualRate"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('annualRate', { valueAsNumber: true })}
        />
        {errors.annualRate && (
          <p className="text-destructive text-xs">{errors.annualRate.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue('color', c)}
              className={`size-7 rounded-full transition-transform hover:scale-110 ${
                selectedColor === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : ''
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {editing ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </div>
    </form>
  )
}
