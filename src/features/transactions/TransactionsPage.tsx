import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PeriodSelector } from './components/PeriodSelector'
import { PeriodSummaryCards } from './components/PeriodSummaryCards'
import { TransactionList } from './components/TransactionList'
import { TransactionForm } from './components/TransactionForm'
import { FilterBar, EMPTY_FILTERS, type FilterState } from './components/FilterBar'

export function Component() {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transacciones</h1>
        <Button onClick={() => setOpen(true)}>+ Movimiento</Button>
      </div>

      {/* Period selector */}
      <PeriodSelector />

      {/* Summary cards — always show full period totals, unaffected by filters */}
      <PeriodSummaryCards />

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Transaction list */}
      <TransactionList filters={filters} />

      {/* New transaction dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo movimiento</DialogTitle>
          </DialogHeader>
          <TransactionForm onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
