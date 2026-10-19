import { createContext } from 'react'

import type { FeatureFlagOverrides } from '../utils/feature-flags'

export const FeatureFlagsContext = createContext<FeatureFlagOverrides | null>(null)
