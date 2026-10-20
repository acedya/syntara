import { createRoute } from '@tanstack/react-router'

import { FeatureFlagDemo } from '../lazyRoutes'
import { makeRouteComponent } from '../makeRouteComponent'

import { rootRoute } from './__root'

export const featureFlagDemoRoutes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/feature-flag-demo',
    component: makeRouteComponent(<FeatureFlagDemo />),
  }),
]
