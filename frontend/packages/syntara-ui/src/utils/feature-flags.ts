import { z } from 'zod'

/** All feature flags registered in the Syntara UI. */
export const FEATURE_FLAG_NAMES = ['workflow_builder_qol'] as const

/** The names callers may use when checking a feature flag. */
export type FeatureFlagName = (typeof FEATURE_FLAG_NAMES)[number]

/** Browser storage key containing saved values for registered feature flags. */
export const FEATURE_FLAG_STORAGE_KEY = 'feature-flags'

const featureFlagNameSchema = z.enum(FEATURE_FLAG_NAMES)
const featureFlagSchema = z.partialRecord(featureFlagNameSchema, z.boolean())

/** Saved values for registered feature flags. */
export type FeatureFlag = z.infer<typeof featureFlagSchema>

let cachedSerializedFlags: string | null | undefined
let cachedFeatureFlags: FeatureFlag | undefined

/** Returns true only when a registered flag has the stored boolean value `true`. */
export function isFeatureFlagEnabled(flagName: FeatureFlagName): boolean {
  try {
    const serializedFlags = globalThis.localStorage?.getItem(FEATURE_FLAG_STORAGE_KEY) ?? null
    if (cachedFeatureFlags === undefined || serializedFlags !== cachedSerializedFlags) {
      cachedSerializedFlags = serializedFlags
      if (serializedFlags === null) {
        cachedFeatureFlags = {}
      } else {
        const storedValue: unknown = JSON.parse(serializedFlags)
        const result = featureFlagSchema.safeParse(storedValue)
        cachedFeatureFlags = result.success ? result.data : {}
      }
    }

    return cachedFeatureFlags[flagName] === true
  } catch {
    return false
  }
}
