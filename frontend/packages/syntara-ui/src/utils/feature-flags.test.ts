import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest'

import { FEATURE_FLAG_STORAGE_KEY, isFeatureFlagEnabled } from './feature-flags'
import type { FeatureFlagName } from './feature-flags'

type IsFeatureFlagEnabled = typeof isFeatureFlagEnabled

beforeEach(() => {
  globalThis.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY)
})

afterEach(() => {
  globalThis.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY)
})

describe('feature flag TypeScript API', () => {
  it('only accepts names from the registered flag union', () => {
    expectTypeOf<IsFeatureFlagEnabled>().parameter(0).toEqualTypeOf<FeatureFlagName>()
    expectTypeOf<'unregistered_flag'>().not.toExtend<FeatureFlagName>()
  })
})

describe('isFeatureFlagEnabled', () => {
  it('defaults a missing flag to off', () => {
    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)
  })

  it('enables a registered flag only for the boolean value true', () => {
    globalThis.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, '{"workflow_builder_qol":true}')

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(true)
  })

  it('keeps a flag off when its stored value is false', () => {
    globalThis.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, '{"workflow_builder_qol":false}')

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)
  })

  it('does not coerce a string value to true', () => {
    globalThis.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, '{"workflow_builder_qol":"true"}')

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)
  })

  it('treats an unknown stored flag name as an invalid configuration', () => {
    globalThis.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, '{"workflow_builder_qol":true,"unregistered_flag":true}')

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)
  })

  it('treats malformed JSON as all flags off', () => {
    globalThis.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, '{')

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)
  })
})
