import { use } from 'react'

import type { FeatureFlagName } from '../utils/feature-flags'

import { FeatureFlagsContext } from './feature-flags-context'

/** Returns whether a registered feature flag is enabled in the current app snapshot. */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  const overrides = use(FeatureFlagsContext)
  if (overrides === null) {
    throw new Error('useFeatureFlag must be used within FeatureFlagsProvider')
  }

  return overrides[flagName] === true
}
