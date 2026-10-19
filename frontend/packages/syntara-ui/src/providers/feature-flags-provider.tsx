import { useState, type ReactNode } from 'react'

import { readFeatureFlagOverrides } from '../utils/feature-flags'

import { FeatureFlagsContext } from './feature-flags-context'

/** Reads browser flag overrides once and provides them to React components. */
export function FeatureFlagsProvider(props: Readonly<{ children: ReactNode }>) {
  const [overrides] = useState(readFeatureFlagOverrides)

  return <FeatureFlagsContext.Provider value={overrides}>{props.children}</FeatureFlagsContext.Provider>
}
