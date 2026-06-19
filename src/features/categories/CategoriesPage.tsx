import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, categoriesRepo } from '@/db'
import type { Category, CategoryType } from '@/db/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PRESET_COLORS = [
  '#22c55e', '#16a34a', '#3b82f6', '#0ea5e9', '#a855f7',
  '#ec4899', '#ef4444', '#f97316', '#eab308', '#06b6d4',
  '#6366f1', '#b45309', '#9ca3af', '#6b7280',
]

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.enum(['income', 'expense']),
  color: z.string().min(1, 'Selecciona un color'),
  icon: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

export function Component() {
  const categories = useLiveQuery(() => db.categories.orderBy('name').toArray(), [])
  const [activeType, setActiveType] = useState<CategoryType>('expense')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'expense', color: '#6b7280', icon: 'Tag' },
  })

  const selectedColor = watch('color')

  const filtered = categories?.filter((c) => c.type === activeType) ?? []

  function openCreate() {
    reset({ name: '', type: activeType, color: '#6b7280', icon: 'Tag' })
    setEditingId(null)
    setOpen(true)
  }

  function openEdit(cat: Category) {
    reset({ name: cat.name, type: cat.type, color: cat.color, icon: cat.icon })
    setEditingId(cat.id!)
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    if (editingId) {
      await categoriesRepo.update(editingId, values)
    } else {
      await categoriesRepo.create({ ...values, isDefault: false })
    }
    setOpen(false)
    reset()
  }

  async function handleDelete() {
    if (!deletingId) return
    try {
      setDeleteError(null)
      await categoriesRepo.remove(deletingId)
      setDeletingId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar.')
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categorías</h1>
        <Button onClick={openCreate}>+ Categoría</Button>
      </div>

      {/* Type tabs */}
      <div className="flex gap-2">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors ${
              activeType === t
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {t === 'income' ? 'Ingresos' : 'Egresos'}
          </button>
        ))}
      </div>

      {/* Category list */}
      <div className="divide-y divide-border rounded-lg border">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">
            No hay categorías de {activeType === 'income' ? 'ingresos' : 'egresos'}.
          </p>
        ) : (
          filtered.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: cat.color }}
              />
              <div className="flex-1">
                <span className="text-sm font-medium">{cat.name}</span>
                {cat.isDefault && (
                  <span className="text-muted-foreground ml-2 rounded border px-1.5 text-[10px]">
                    predeterminada
                  </span>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => openEdit(cat)}
                  className="text-muted-foreground hover:text-foreground rounded p-1 text-xs"
                >
                  ✏
                </button>
                {!cat.isDefault && (
                  <button
                    onClick={() => { setDeleteError(null); setDeletingId(cat.id!) }}
                    className="text-muted-foreground hover:text-destructive rounded p-1 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) setOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="cat-name">Nombre</Label>
              <Input id="cat-name" placeholder="ej. Gimnasio" {...register('name')} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                onValueChange={(v: string | null) => { if (v) setValue('type', v as CategoryType) }}
                defaultValue={activeType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue('color', color)}
                    className={`size-7 rounded-full transition-transform ${
                      selectedColor === color ? 'ring-2 ring-primary ring-offset-2 scale-110' : ''
                    }`}
                    style={{ background: color }}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingId ? 'Guardar' : 'Crear'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o: boolean) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ?? 'Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
