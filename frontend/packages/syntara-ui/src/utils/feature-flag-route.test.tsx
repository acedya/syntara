import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FEATURE_FLAG_STORAGE_KEY, isFeatureFlagEnabled } from './feature-flags'

function createFeatureFlagRouter() {
  const rootRoute = createRootRoute({ component: Outlet })
  const fallbackRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/fallback',
    component: () => <h1>Fallback route</h1>,
  })
  const featureRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/feature',
    beforeLoad: () => {
      if (!isFeatureFlagEnabled('workflow_builder_qol')) {
        return redirect({ to: '/fallback', replace: true })
      }
    },
    component: () => <h1>Feature route</h1>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([fallbackRoute, featureRoute]),
    history: createMemoryHistory({ initialEntries: ['/feature'] }),
    defaultPendingMinMs: 0,
  })

  return router
}

beforeEach(() => {
  globalThis.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY)
})

afterEach(() => {
  globalThis.localStorage.removeItem(FEATURE_FLAG_STORAGE_KEY)
})

describe('feature flag route guard', () => {
  it('redirects from a code-based route when the flag is off', async () => {
    const router = createFeatureFlagRouter()

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Fallback route' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Feature route' })).not.toBeInTheDocument()
  })

  it('loads a code-based route when the flag is on', async () => {
    globalThis.localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify({ workflow_builder_qol: true }))
    const router = createFeatureFlagRouter()

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Feature route' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Fallback route' })).not.toBeInTheDocument()
  })
})
