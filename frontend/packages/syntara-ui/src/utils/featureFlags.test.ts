import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import { FEATURE_FLAG_STORAGE_KEY } from './featureFlags'
import type { FeatureFlagName } from './featureFlags'

type IsFeatureFlagEnabled = typeof import('./featureFlags').isFeatureFlagEnabled

async function loadFeatureFlags(storedValue: string | null) {
  vi.resetModules()
  if (storedValue === null) {
    globalThis.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY)
  } else {
    globalThis.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, storedValue)
  }

  const featureFlags = await import('./featureFlags')
  featureFlags.initializeFeatureFlags()
  return featureFlags
}

afterEach(() => {
  globalThis.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY)
  vi.resetModules()
})

describe('feature flag TypeScript API', () => {
  it('only accepts names from the registered flag union', () => {
    expectTypeOf<IsFeatureFlagEnabled>().parameter(0).toEqualTypeOf<FeatureFlagName>()
    expectTypeOf<'unregistered_flag'>().not.toExtend<FeatureFlagName>()
  })
})

describe('isFeatureFlagEnabled', () => {
  it('defaults a missing flag to off', async () => {
    const { isFeatureFlagEnabled } = await loadFeatureFlags(null)

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)
  })

  it('enables a registered flag only for the boolean value true', async () => {
    const { isFeatureFlagEnabled } = await loadFeatureFlags('{"workflow_builder_qol":true}')

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(true)
  })

  it('does not coerce a string value to true', async () => {
    const { isFeatureFlagEnabled } = await loadFeatureFlags('{"workflow_builder_qol":"true"}')

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)
  })

  it('treats an unknown stored flag name as an invalid configuration', async () => {
    const { isFeatureFlagEnabled } = await loadFeatureFlags('{"workflow_builder_qol":true,"unregistered_flag":true}')

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)
  })

  it('treats malformed JSON as all flags off', async () => {
    const { isFeatureFlagEnabled } = await loadFeatureFlags('{')

    expect(isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)
  })

  it('keeps the initial snapshot until a page reload', async () => {
    const firstLoad = await loadFeatureFlags('{"workflow_builder_qol":false}')
    globalThis.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, '{"workflow_builder_qol":true}')

    expect(firstLoad.isFeatureFlagEnabled('workflow_builder_qol')).toBe(false)

    const reloaded = await loadFeatureFlags('{"workflow_builder_qol":true}')
    expect(reloaded.isFeatureFlagEnabled('workflow_builder_qol')).toBe(true)
  })
})
