import type { Reimbursement } from '@/db/types'

export interface PersonGroup {
  personName: string
  items: Reimbursement[]
  pendingTotal: number
}

export function groupByPerson(reimbursements: Reimbursement[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>()
  for (const r of reimbursements) {
    const key = r.personName.toLowerCase().trim()
    const existing = map.get(key)
    if (existing) {
      existing.items.push(r)
      if (!r.isPaid) existing.pendingTotal += r.amount
    } else {
      map.set(key, {
        personName: r.personName,
        items: [r],
        pendingTotal: r.isPaid ? 0 : r.amount,
      })
    }
  }
  return Array.from(map.values())
}

export function calcTotalPending(reimbursements: Reimbursement[]): number {
  return reimbursements
    .filter((r) => !r.isPaid)
    .reduce((sum, r) => sum + r.amount, 0)
}

export function sortGroupsByAmount(groups: PersonGroup[]): PersonGroup[] {
  return [...groups].sort((a, b) => b.pendingTotal - a.pendingTotal)
}
