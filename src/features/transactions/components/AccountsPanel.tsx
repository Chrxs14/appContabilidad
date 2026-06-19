import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { accountsRepo } from '@/db'
import { useUIStore } from '@/store/uiStore'
import { useAccountsWithBalances } from '../hooks/useAccounts'
import type { AccountType } from '@/db/types'

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'bank', label: 'Banco' },
  { value: 'debit', label: 'Débito' },
]

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.enum(['cash', 'bank', 'debit']),
  initialBalance: z.number(),
})

type FormValues = z.infer<typeof schema>

export function AccountsPanel() {
  const { formatAmount } = useUIStore()
  const accountsWithBalances = useAccountsWithBalances()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const editing = accountsWithBalances?.find((a) => a.account.id === editingId)

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function openCreate() {
    reset({ name: '', type: 'bank', initialBalance: 0 })
    setCreating(true)
  }

  function openEdit(id: number) {
    const entry = accountsWithBalances?.find((a) => a.account.id === id)
    if (!entry) return
    reset({
      name: entry.account.name,
      type: entry.account.type,
      initialBalance: entry.account.initialBalance,
    })
    setEditingId(id)
  }

  async function onSubmit(values: FormValues) {
    if (editingId) {
      await accountsRepo.update(editingId, values)
      setEditingId(null)
    } else {
      await accountsRepo.create({ ...values, isDefault: false })
      setCreating(false)
    }
    reset()
  }

  async function handleDelete() {
    if (!deletingId) return
    try {
      setDeleteError(null)
      await accountsRepo.remove(deletingId)
      setDeletingId(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar la cuenta.')
    }
  }

  const totalBalance = accountsWithBalances?.reduce((sum, a) => sum + a.balance, 0) ?? 0
  const positiveTotal = accountsWithBalances?.reduce((sum, a) => sum + Math.max(0, a.balance), 0) ?? 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Cuentas</h2>
          <p className="text-muted-foreground text-xs">
            Total disponible:{' '}
            <span className="font-semibold text-foreground">{formatAmount(totalBalance)}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openCreate}>
          + Cuenta
        </Button>
      </div>

      {/* Account list */}
      <div className="divide-y divide-border rounded-lg border">
        {!accountsWithBalances || accountsWithBalances.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">
            No hay cuentas registradas.
          </p>
        ) : (
          accountsWithBalances.map(({ account, balance }) => {
            const pct = positiveTotal > 0 ? (Math.max(0, balance) / positiveTotal) * 100 : 0
            return (
              <div key={account.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{account.name}</p>
                    {account.isDefault && (
                      <span className="text-muted-foreground rounded border px-1.5 text-[10px]">
                        predeterminada
                      </span>
                    )}
                  </div>
                  {/* Distribution bar */}
                  <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {pct.toFixed(0)}% del total
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold tabular-nums ${balance < 0 ? 'text-red-500' : ''}`}>
                    {formatAmount(balance)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(account.id!)}
                    className="text-muted-foreground hover:text-foreground rounded p-1 text-xs"
                    aria-label="Editar"
                  >
                    ✏
                  </button>
                  {!account.isDefault && (
                    <button
                      onClick={() => { setDeleteError(null); setDeletingId(account.id!) }}
                      className="text-muted-foreground hover:text-destructive rounded p-1 text-xs"
                      aria-label="Eliminar"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={creating || !!editingId}
        onOpenChange={(open: boolean) => { if (!open) { setCreating(false); setEditingId(null) } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="acc-name">Nombre</Label>
              <Input id="acc-name" placeholder="ej. BBVA nómina" {...register('name')} />
              {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                items={ACCOUNT_TYPES}
                onValueChange={(v: string | null) => { if (v) setValue('type', v as AccountType) }}
                defaultValue={editing?.account.type ?? 'bank'}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="init-balance">Saldo inicial</Label>
              <Input
                id="init-balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('initialBalance', { valueAsNumber: true })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => { setCreating(false); setEditingId(null) }}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingId ? 'Guardar' : 'Crear cuenta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(open: boolean) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
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
