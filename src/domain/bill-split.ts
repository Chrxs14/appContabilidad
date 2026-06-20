import type { SplitMode, ServiceMode } from '@/db/types'

export const IVA_RATE = 0.15

export interface SplitItem {
  name: string
  unitPrice: number
  quantity: number
  assignedTo: string[]  // [] = todos los del grupo
}

export interface SplitInput {
  people: string[]
  items: SplitItem[]
  hasIVA: boolean
  hasServiceCharge: boolean
  serviceMode: ServiceMode
  serviceValue: number   // percent → 10 significa 10 %; fixed → monto exacto
  splitMode: SplitMode
}

export interface ItemShare {
  itemName: string
  amount: number
}

export interface PersonShare {
  name: string
  itemsSubtotal: number
  serviceShare: number
  ivaShare: number
  total: number
  breakdown: ItemShare[]
}

export interface SplitResult {
  subtotal: number
  serviceAmount: number
  ivaAmount: number
  grandTotal: number
  perPerson: PersonShare[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function splitBill(input: SplitInput): SplitResult {
  const { people, items, hasIVA, hasServiceCharge, serviceMode, serviceValue, splitMode } = input

  const subtotal = round2(
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  )

  const serviceAmount = hasServiceCharge
    ? round2(serviceMode === 'percent' ? subtotal * serviceValue / 100 : serviceValue)
    : 0

  const ivaAmount = hasIVA ? round2(subtotal * IVA_RATE) : 0
  const grandTotal = round2(subtotal + serviceAmount + ivaAmount)

  if (people.length === 0) {
    return { subtotal, serviceAmount, ivaAmount, grandTotal, perPerson: [] }
  }

  const n = people.length

  if (splitMode === 'equal' || items.length === 0) {
    const rawShare = grandTotal / n
    const shares = people.map(() => round2(rawShare))

    const diff = round2(grandTotal - shares.reduce((a, b) => a + b, 0))
    if (diff !== 0) shares[0] = round2(shares[0]! + diff)

    return {
      subtotal,
      serviceAmount,
      ivaAmount,
      grandTotal,
      perPerson: people.map((name, i) => ({
        name,
        itemsSubtotal: round2(subtotal / n),
        serviceShare: round2(serviceAmount / n),
        ivaShare: round2(ivaAmount / n),
        total: shares[i]!,
        breakdown: [],
      })),
    }
  }

  // ── by_consumption ───────────────────────────────────────────────────────────
  const personSubtotals = new Map<string, number>(people.map((p) => [p, 0]))
  const personBreakdowns = new Map<string, ItemShare[]>(people.map((p) => [p, []]))

  for (const item of items) {
    const itemTotal = item.unitPrice * item.quantity
    const validAssignees = item.assignedTo.filter((a) => people.includes(a))
    const assignees = validAssignees.length > 0 ? validAssignees : people
    const perAssignee = itemTotal / assignees.length

    for (const person of assignees) {
      personSubtotals.set(person, (personSubtotals.get(person) ?? 0) + perAssignee)
      personBreakdowns.get(person)!.push({ itemName: item.name, amount: round2(perAssignee) })
    }
  }

  const perPerson: PersonShare[] = people.map((name) => {
    const personSubtotal = personSubtotals.get(name) ?? 0
    const proportion = subtotal > 0 ? personSubtotal / subtotal : 1 / n
    const serviceShare = round2(serviceAmount * proportion)
    const ivaShare = round2(ivaAmount * proportion)
    const total = round2(round2(personSubtotal) + serviceShare + ivaShare)

    return {
      name,
      itemsSubtotal: round2(personSubtotal),
      serviceShare,
      ivaShare,
      total,
      breakdown: personBreakdowns.get(name) ?? [],
    }
  })

  // absorb rounding difference in first person
  const diff = round2(grandTotal - round2(perPerson.reduce((s, p) => s + p.total, 0)))
  if (diff !== 0) perPerson[0]!.total = round2(perPerson[0]!.total + diff)

  return { subtotal, serviceAmount, ivaAmount, grandTotal, perPerson }
}
