import { z } from 'zod'

/** All feature flags registered in the Syntara UI. */
const FEATURE_FLAG_NAMES = ['workflow_builder_qol'] as const

/** The names callers may use when checking a feature flag. */
export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number]

/** Browser storage key containing local overrides for registered feature flags. */
export const FEATURE_FLAG_STORAGE_KEY = 'syntara-ui-feature-flags'

const featureFlagNameSchema = z.enum(FEATURE_FLAG_NAMES)
const featureFlagOverridesSchema = z.partialRecord(featureFlagNameSchema, z.boolean())

type FeatureFlagOverrides = z.infer<typeof featureFlagOverridesSchema>

let featureFlagOverrides: FeatureFlagOverrides | undefined

function readFeatureFlagOverrides(): FeatureFlagOverrides {
  try {
    const serializedOverrides = globalThis.localStorage?.getItem(FEATURE_FLAG_STORAGE_KEY)
    if (serializedOverrides === null || serializedOverrides === undefined) {
      return {}
    }

    const storedValue: unknown = JSON.parse(serializedOverrides)
    const result = featureFlagOverridesSchema.safeParse(storedValue)
    return result.success ? result.data : {}
  } catch {
    return {}
  }
}

/**
 * Captures the browser-local overrides once for this page load.
 * Call during application startup so DevTools changes take effect after a reload.
 */
export function initializeFeatureFlags(): void {
  featureFlagOverrides ??= readFeatureFlagOverrides()
}

/** Returns true only when a registered flag has the stored boolean value `true`. */
export function isFeatureFlagEnabled(flagName: FeatureFlagName): boolean {
  initializeFeatureFlags()
  return featureFlagOverrides?.[flagName] === true
}
