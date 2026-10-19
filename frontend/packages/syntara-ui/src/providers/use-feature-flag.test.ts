import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FEATURE_FLAG_STORAGE_KEY } from '../utils/feature-flags'

import { FeatureFlagsProvider } from './feature-flags-provider'
import { useFeatureFlag } from './use-feature-flag'

describe('useFeatureFlag', () => {
  beforeEach(() => {
    globalThis.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY)
  })

  afterEach(() => {
    globalThis.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY)
  })

  it('throws when used outside FeatureFlagsProvider', () => {
    expect(() => renderHook(() => useFeatureFlag('workflow_builder_qol'))).toThrow(
      'useFeatureFlag must be used within FeatureFlagsProvider'
    )
  })

  it('returns true when the registered flag is enabled in local storage', () => {
    globalThis.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify({ workflow_builder_qol: true }))

    const { result } = renderHook(() => useFeatureFlag('workflow_builder_qol'), {
      wrapper: FeatureFlagsProvider,
    })

    expect(result.current).toBe(true)
  })

  it('returns false when the flag is missing from local storage', () => {
    const { result } = renderHook(() => useFeatureFlag('workflow_builder_qol'), {
      wrapper: FeatureFlagsProvider,
    })

    expect(result.current).toBe(false)
  })
})
