import { createContext } from 'react'

import type { FeatureFlag } from '../utils/feature-flags'

export const FeatureFlagsContext = createContext<FeatureFlag | null>(null)
