import { describe, expect, it } from 'vitest'

import { getExecutionDetail } from './executionDetails'

describe('getExecutionDetail', () => {
  it('propagates stall_alert_at from ActivityExecution to ActivityData', () => {
    const detail = getExecutionDetail('exec-stalled')

    expect(detail).toBeDefined()
    expect(detail?.activities).toHaveLength(1)
    expect(detail?.activities?.[0]).toMatchObject({
      activity_id: 'check_temperature',
      status: 'running',
      stall_alert_at: expect.any(String),
    })
  })

  it('includes first_stall_detected_at on execution', () => {
    const detail = getExecutionDetail('exec-stalled')

    expect(detail).toBeDefined()
    expect(detail?.first_stall_detected_at).toBeDefined()

    // Verify timestamp is "live" (approximately 30 minutes ago from real time)
    const stallTs = new Date(detail!.first_stall_detected_at!).getTime()
    const now = Date.now()
    const ageMs = now - stallTs

    // Should be approximately 30 minutes ago (allow 28-32 minute range)
    const expectedAgeMin = 28 * 60 * 1000
    const expectedAgeMax = 32 * 60 * 1000
    expect(ageMs).toBeGreaterThan(expectedAgeMin)
    expect(ageMs).toBeLessThan(expectedAgeMax)
  })

  it('returns undefined stall_alert_at for non-stalled activities', () => {
    const detail = getExecutionDetail('exec-1')

    expect(detail).toBeDefined()
    expect(detail?.activities).toBeDefined()
    expect(detail?.activities?.[0]?.stall_alert_at).toBeUndefined()
  })

  it('exec-stalled uses live timestamps for accurate elapsed-time demo', () => {
    const detail = getExecutionDetail('exec-stalled')

    expect(detail).toBeDefined()
    expect(detail?.started_at).toBeDefined()

    // Verify timestamp is "live" (within last hour, not the fixed June 2026 mock date)
    const startedAtMs = new Date(detail!.started_at!).getTime()
    const now = Date.now()
    const ageMs = now - startedAtMs

    // Should be approximately 45 minutes ago (allow 43-47 minute range)
    const expectedAgeMin = 43 * 60 * 1000
    const expectedAgeMax = 47 * 60 * 1000
    expect(ageMs).toBeGreaterThan(expectedAgeMin)
    expect(ageMs).toBeLessThan(expectedAgeMax)
  })
})
