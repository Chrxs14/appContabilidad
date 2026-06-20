import { describe, it, expect } from 'vitest'
import { splitBill, IVA_RATE } from './bill-split'
import type { SplitInput } from './bill-split'

function base(overrides: Partial<SplitInput> = {}): SplitInput {
  return {
    people: ['Ana', 'Pedro', 'María'],
    items: [
      { name: 'Pizza', unitPrice: 30, quantity: 1, assignedTo: [] },
    ],
    hasIVA: false,
    hasServiceCharge: false,
    serviceMode: 'percent',
    serviceValue: 10,
    splitMode: 'equal',
    ...overrides,
  }
}

// ── subtotal ─────────────────────────────────────────────────────────────────

describe('subtotal', () => {
  it('sums unitPrice × quantity for all items', () => {
    const result = splitBill(base({
      items: [
        { name: 'A', unitPrice: 10, quantity: 2, assignedTo: [] },
        { name: 'B', unitPrice: 5,  quantity: 3, assignedTo: [] },
      ],
    }))
    expect(result.subtotal).toBe(35)
  })

  it('returns 0 when no items', () => {
    const result = splitBill(base({ items: [] }))
    expect(result.subtotal).toBe(0)
  })
})

// ── IVA ──────────────────────────────────────────────────────────────────────

describe('IVA', () => {
  it('adds 15 % on subtotal when hasIVA is true', () => {
    const result = splitBill(base({ hasIVA: true }))
    expect(result.ivaAmount).toBe(30 * IVA_RATE)
    expect(result.grandTotal).toBe(30 + 30 * IVA_RATE)
  })

  it('adds nothing when hasIVA is false', () => {
    const result = splitBill(base({ hasIVA: false }))
    expect(result.ivaAmount).toBe(0)
    expect(result.grandTotal).toBe(30)
  })

  it('applies IVA on subtotal only (not on service)', () => {
    const result = splitBill(base({
      hasIVA: true,
      hasServiceCharge: true,
      serviceMode: 'percent',
      serviceValue: 10,
    }))
    expect(result.ivaAmount).toBe(round2(30 * 0.15))
    expect(result.serviceAmount).toBe(3)
    expect(result.grandTotal).toBe(round2(30 + 3 + 30 * 0.15))
  })
})

// ── service charge ────────────────────────────────────────────────────────────

describe('service charge', () => {
  it('adds percent of subtotal', () => {
    const result = splitBill(base({
      hasServiceCharge: true,
      serviceMode: 'percent',
      serviceValue: 10,
    }))
    expect(result.serviceAmount).toBe(3)
  })

  it('adds fixed amount directly', () => {
    const result = splitBill(base({
      hasServiceCharge: true,
      serviceMode: 'fixed',
      serviceValue: 7.5,
    }))
    expect(result.serviceAmount).toBe(7.5)
  })

  it('adds nothing when hasServiceCharge is false', () => {
    const result = splitBill(base({ hasServiceCharge: false }))
    expect(result.serviceAmount).toBe(0)
  })
})

// ── equal split ───────────────────────────────────────────────────────────────

describe('equal split', () => {
  it('divides grand total equally among all people', () => {
    const result = splitBill(base({ splitMode: 'equal' }))
    expect(result.perPerson).toHaveLength(3)
    result.perPerson.forEach((p) => expect(p.total).toBe(10))
  })

  it('the sum of per-person totals equals grandTotal', () => {
    const result = splitBill(base({ hasIVA: true, splitMode: 'equal' }))
    const sum = result.perPerson.reduce((s, p) => s + p.total, 0)
    expect(round2(sum)).toBe(result.grandTotal)
  })

  it('handles rounding: 3 people, $10 total', () => {
    const result = splitBill(base({
      items: [{ name: 'X', unitPrice: 10, quantity: 1, assignedTo: [] }],
      people: ['A', 'B', 'C'],
      splitMode: 'equal',
    }))
    const totals = result.perPerson.map((p) => p.total)
    expect(round2(totals.reduce((a, b) => a + b, 0))).toBe(10)
    expect(totals).toContain(3.34)
    expect(totals.filter((t) => t === 3.33)).toHaveLength(2)
  })

  it('returns empty perPerson when people list is empty', () => {
    const result = splitBill(base({ people: [] }))
    expect(result.perPerson).toHaveLength(0)
  })
})

// ── by_consumption split ──────────────────────────────────────────────────────

describe('by_consumption split', () => {
  it('assigns item to one specific person', () => {
    const result = splitBill(base({
      people: ['Ana', 'Pedro'],
      items: [
        { name: 'Pizza', unitPrice: 20, quantity: 1, assignedTo: ['Ana'] },
        { name: 'Soda',  unitPrice: 10, quantity: 1, assignedTo: ['Pedro'] },
      ],
      splitMode: 'by_consumption',
    }))
    const ana   = result.perPerson.find((p) => p.name === 'Ana')!
    const pedro = result.perPerson.find((p) => p.name === 'Pedro')!
    expect(ana.itemsSubtotal).toBe(20)
    expect(pedro.itemsSubtotal).toBe(10)
  })

  it('splits shared item equally among assignees', () => {
    const result = splitBill(base({
      people: ['Ana', 'Pedro', 'María'],
      items: [
        { name: 'Pizza', unitPrice: 30, quantity: 1, assignedTo: ['Ana', 'Pedro'] },
      ],
      splitMode: 'by_consumption',
    }))
    const ana   = result.perPerson.find((p) => p.name === 'Ana')!
    const pedro = result.perPerson.find((p) => p.name === 'Pedro')!
    const maria = result.perPerson.find((p) => p.name === 'María')!
    expect(ana.itemsSubtotal).toBe(15)
    expect(pedro.itemsSubtotal).toBe(15)
    expect(maria.itemsSubtotal).toBe(0)
  })

  it('splits unassigned item among all people', () => {
    const result = splitBill(base({
      people: ['Ana', 'Pedro'],
      items: [{ name: 'Pizza', unitPrice: 20, quantity: 1, assignedTo: [] }],
      splitMode: 'by_consumption',
    }))
    result.perPerson.forEach((p) => expect(p.itemsSubtotal).toBe(10))
  })

  it('ignores assignedTo names not in the people list', () => {
    const result = splitBill(base({
      people: ['Ana', 'Pedro'],
      items: [{ name: 'Pizza', unitPrice: 20, quantity: 1, assignedTo: ['Carlos'] }],
      splitMode: 'by_consumption',
    }))
    // 'Carlos' is not in people → falls back to all
    result.perPerson.forEach((p) => expect(p.itemsSubtotal).toBe(10))
  })

  it('distributes IVA and service proportionally', () => {
    const result = splitBill(base({
      people: ['Ana', 'Pedro'],
      items: [
        { name: 'A', unitPrice: 60, quantity: 1, assignedTo: ['Ana'] },
        { name: 'B', unitPrice: 40, quantity: 1, assignedTo: ['Pedro'] },
      ],
      hasIVA: true,
      hasServiceCharge: true,
      serviceMode: 'percent',
      serviceValue: 10,
      splitMode: 'by_consumption',
    }))
    // subtotal=100, service=10, iva=15, grand=125
    expect(result.grandTotal).toBe(125)
    const ana   = result.perPerson.find((p) => p.name === 'Ana')!
    const pedro = result.perPerson.find((p) => p.name === 'Pedro')!
    // Ana proportion = 60/100 = 0.6
    expect(ana.serviceShare).toBe(round2(10 * 0.6))
    expect(ana.ivaShare).toBe(round2(15 * 0.6))
    expect(pedro.serviceShare).toBe(round2(10 * 0.4))
    expect(pedro.ivaShare).toBe(round2(15 * 0.4))
  })

  it('sum of by_consumption totals equals grandTotal', () => {
    const result = splitBill(base({
      people: ['Ana', 'Pedro', 'María'],
      items: [
        { name: 'A', unitPrice: 33, quantity: 1, assignedTo: ['Ana'] },
        { name: 'B', unitPrice: 33, quantity: 1, assignedTo: ['Pedro'] },
        { name: 'C', unitPrice: 34, quantity: 1, assignedTo: ['María'] },
      ],
      hasIVA: true,
      hasServiceCharge: true,
      serviceMode: 'fixed',
      serviceValue: 5,
      splitMode: 'by_consumption',
    }))
    const sum = round2(result.perPerson.reduce((s, p) => s + p.total, 0))
    expect(sum).toBe(result.grandTotal)
  })

  it('falls back to equal split when there are no items', () => {
    const result = splitBill(base({
      people: ['Ana', 'Pedro'],
      items: [],
      splitMode: 'by_consumption',
    }))
    result.perPerson.forEach((p) => expect(p.total).toBe(0))
  })
})

function round2(n: number) {
  return Math.round(n * 100) / 100
}
