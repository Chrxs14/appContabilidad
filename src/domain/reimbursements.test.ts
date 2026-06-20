import { describe, it, expect } from 'vitest'
import { groupByPerson, calcTotalPending, sortGroupsByAmount } from './reimbursements'
import type { Reimbursement } from '@/db/types'

function makeR(overrides: Partial<Reimbursement> = {}): Reimbursement {
  return {
    id: 1,
    transactionId: 1,
    personName: 'Ana',
    amount: 100,
    isPaid: false,
    createdAt: new Date('2026-06-01'),
    ...overrides,
  }
}

// ── calcTotalPending ──────────────────────────────────────────────────────────

describe('calcTotalPending', () => {
  it('returns 0 for empty array', () => {
    expect(calcTotalPending([])).toBe(0)
  })

  it('sums only unpaid items', () => {
    const items = [
      makeR({ amount: 100, isPaid: false }),
      makeR({ amount: 200, isPaid: true }),
      makeR({ amount: 50,  isPaid: false }),
    ]
    expect(calcTotalPending(items)).toBe(150)
  })

  it('returns 0 when all are paid', () => {
    const items = [
      makeR({ amount: 100, isPaid: true }),
      makeR({ amount: 300, isPaid: true }),
    ]
    expect(calcTotalPending(items)).toBe(0)
  })

  it('returns full sum when all are pending', () => {
    const items = [
      makeR({ amount: 80,  isPaid: false }),
      makeR({ amount: 120, isPaid: false }),
    ]
    expect(calcTotalPending(items)).toBe(200)
  })
})

// ── groupByPerson ─────────────────────────────────────────────────────────────

describe('groupByPerson', () => {
  it('returns empty array for empty input', () => {
    expect(groupByPerson([])).toEqual([])
  })

  it('creates one group per distinct person', () => {
    const items = [
      makeR({ id: 1, personName: 'Ana',   amount: 100, isPaid: false }),
      makeR({ id: 2, personName: 'Pedro', amount: 200, isPaid: false }),
    ]
    const groups = groupByPerson(items)
    expect(groups).toHaveLength(2)
  })

  it('groups items case-insensitively', () => {
    const items = [
      makeR({ id: 1, personName: 'Ana',  amount: 100, isPaid: false }),
      makeR({ id: 2, personName: 'ANA',  amount: 50,  isPaid: false }),
      makeR({ id: 3, personName: 'ana',  amount: 30,  isPaid: false }),
    ]
    const groups = groupByPerson(items)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.items).toHaveLength(3)
    expect(groups[0]!.pendingTotal).toBe(180)
  })

  it('pendingTotal only counts unpaid items', () => {
    const items = [
      makeR({ id: 1, personName: 'Ana', amount: 100, isPaid: false }),
      makeR({ id: 2, personName: 'Ana', amount: 300, isPaid: true }),
    ]
    const groups = groupByPerson(items)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.items).toHaveLength(2)
    expect(groups[0]!.pendingTotal).toBe(100)
  })

  it('pendingTotal is 0 when all items for a person are paid', () => {
    const items = [
      makeR({ id: 1, personName: 'Ana', amount: 500, isPaid: true }),
    ]
    const groups = groupByPerson(items)
    expect(groups[0]!.pendingTotal).toBe(0)
  })

  it('preserves the original personName casing from first occurrence', () => {
    const items = [
      makeR({ id: 1, personName: 'Juan García', amount: 100, isPaid: false }),
      makeR({ id: 2, personName: 'juan garcía', amount: 50,  isPaid: false }),
    ]
    const groups = groupByPerson(items)
    expect(groups[0]!.personName).toBe('Juan García')
  })
})

// ── sortGroupsByAmount ────────────────────────────────────────────────────────

describe('sortGroupsByAmount', () => {
  it('returns empty array for empty input', () => {
    expect(sortGroupsByAmount([])).toEqual([])
  })

  it('sorts by pendingTotal descending', () => {
    const groups = [
      { personName: 'A', items: [], pendingTotal: 50  },
      { personName: 'B', items: [], pendingTotal: 200 },
      { personName: 'C', items: [], pendingTotal: 100 },
    ]
    const sorted = sortGroupsByAmount(groups)
    expect(sorted.map((g) => g.pendingTotal)).toEqual([200, 100, 50])
  })

  it('does not mutate the original array', () => {
    const groups = [
      { personName: 'A', items: [], pendingTotal: 10 },
      { personName: 'B', items: [], pendingTotal: 20 },
    ]
    sortGroupsByAmount(groups)
    expect(groups[0]!.personName).toBe('A')
  })

  it('keeps stable order for equal pendingTotal', () => {
    const groups = [
      { personName: 'A', items: [], pendingTotal: 100 },
      { personName: 'B', items: [], pendingTotal: 100 },
    ]
    const sorted = sortGroupsByAmount(groups)
    expect(sorted).toHaveLength(2)
    expect(sorted.map((g) => g.pendingTotal)).toEqual([100, 100])
  })
})
