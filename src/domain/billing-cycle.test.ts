import { describe, it, expect } from 'vitest'
import { getCurrentBillingCycle } from './billing-cycle'

describe('getCurrentBillingCycle', () => {
  it('cycle ends this month when today is before cutDay', () => {
    const ref = new Date(2024, 5, 13) // June 13
    const cycle = getCurrentBillingCycle(15, 20, ref)
    expect(cycle.cycleEnd).toEqual(new Date(2024, 5, 15)) // June 15
    expect(cycle.cycleStart).toEqual(new Date(2024, 4, 16)) // May 16
  })

  it('cycle ends this month when today IS the cutDay', () => {
    const ref = new Date(2024, 5, 15) // June 15
    const cycle = getCurrentBillingCycle(15, 20, ref)
    expect(cycle.cycleEnd).toEqual(new Date(2024, 5, 15))
    expect(cycle.cycleStart).toEqual(new Date(2024, 4, 16))
  })

  it('cycle ends next month when today is after cutDay', () => {
    const ref = new Date(2024, 5, 16) // June 16
    const cycle = getCurrentBillingCycle(15, 20, ref)
    expect(cycle.cycleEnd).toEqual(new Date(2024, 6, 15)) // July 15
    expect(cycle.cycleStart).toEqual(new Date(2024, 5, 16)) // June 16
  })

  it('handles January: previous cut falls in December of prior year', () => {
    const ref = new Date(2024, 0, 10) // January 10
    const cycle = getCurrentBillingCycle(15, 20, ref)
    expect(cycle.cycleEnd).toEqual(new Date(2024, 0, 15)) // January 15, 2024
    expect(cycle.cycleStart).toEqual(new Date(2023, 11, 16)) // December 16, 2023
  })

  it('handles December: next cut falls in January of next year', () => {
    const ref = new Date(2024, 11, 20) // December 20
    const cycle = getCurrentBillingCycle(15, 20, ref)
    expect(cycle.cycleEnd).toEqual(new Date(2025, 0, 15)) // January 15, 2025
    expect(cycle.cycleStart).toEqual(new Date(2024, 11, 16)) // December 16, 2024
  })

  it('clamps cutDay 31 to last day of February (non-leap year)', () => {
    const ref = new Date(2023, 1, 20) // February 20
    const cycle = getCurrentBillingCycle(31, 20, ref)
    expect(cycle.cycleEnd).toEqual(new Date(2023, 1, 28)) // February 28
  })

  it('clamps cutDay 31 to last day of February (leap year)', () => {
    const ref = new Date(2024, 1, 20) // February 20
    const cycle = getCurrentBillingCycle(31, 20, ref)
    expect(cycle.cycleEnd).toEqual(new Date(2024, 1, 29)) // February 29
  })

  it('computes payment deadline: cut + paymentDays, crossing month boundary', () => {
    const ref = new Date(2024, 5, 13) // June 13
    const cycle = getCurrentBillingCycle(15, 20, ref)
    // cycleEnd = June 15, +20 days = July 5
    expect(cycle.paymentDeadline).toEqual(new Date(2024, 6, 5))
  })

  it('computes payment deadline within same month', () => {
    const ref = new Date(2024, 5, 1) // June 1, cutDay=20, paymentDays=5
    const cycle = getCurrentBillingCycle(20, 5, ref)
    // cycleEnd = June 20, +5 days = June 25
    expect(cycle.paymentDeadline).toEqual(new Date(2024, 5, 25))
  })

  it('daysUntilCut is 2 when cut is 2 days away', () => {
    const ref = new Date(2024, 5, 13) // June 13, cutDay=15
    const { daysUntilCut } = getCurrentBillingCycle(15, 20, ref)
    expect(daysUntilCut).toBe(2)
  })

  it('daysUntilCut is 0 on cut day itself', () => {
    const ref = new Date(2024, 5, 15)
    const { daysUntilCut } = getCurrentBillingCycle(15, 20, ref)
    expect(daysUntilCut).toBe(0)
  })

  it('daysUntilCut is 29 the day after cut (new cycle just started)', () => {
    const ref = new Date(2024, 5, 16) // June 16 → next cut July 15
    const { daysUntilCut } = getCurrentBillingCycle(15, 20, ref)
    expect(daysUntilCut).toBe(29)
  })

  it('daysUntilPayment accounts for paymentDays offset', () => {
    const ref = new Date(2024, 5, 13) // June 13, cut June 15, payment +20 → July 5
    const { daysUntilPayment } = getCurrentBillingCycle(15, 20, ref)
    // June 13 → July 5 = 22 days
    expect(daysUntilPayment).toBe(22)
  })
})
