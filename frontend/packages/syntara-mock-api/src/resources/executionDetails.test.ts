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

  it('includes is_stalled on execution', () => {
    const detail = getExecutionDetail('exec-stalled')

    expect(detail).toBeDefined()
    expect(detail?.is_stalled).toBe(true)
  })

  it('returns undefined stall_alert_at for non-stalled activities', () => {
    const detail = getExecutionDetail('exec-1')

    expect(detail).toBeDefined()
    expect(detail?.activities).toBeDefined()
    expect(detail?.activities?.[0]?.stall_alert_at).toBeUndefined()
  })
})
