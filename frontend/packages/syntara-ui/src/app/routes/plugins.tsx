import { createRoute, redirect } from '@tanstack/react-router'

import { InstalledPluginDetail, PluginDetail, Plugins } from '../lazyRoutes'
import { makeRouteComponent } from '../makeRouteComponent'
import { listSearchParams } from '../routeSearchParams'

import { rootRoute } from './__root'

const pluginsSearch = listSearchParams.catch({})
const installedSearch = listSearchParams.catch({})

export const pluginsRoutes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/plugins',
    validateSearch: pluginsSearch,
    component: makeRouteComponent(<Plugins />, { action: 'read', resourceType: 'plugin' }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/plugins/installed',
    validateSearch: installedSearch,
    component: makeRouteComponent(<Plugins />, { action: 'read', resourceType: 'plugin' }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/plugins/available/$pluginId',
    component: makeRouteComponent(<PluginDetail />, { action: 'read', resourceType: 'plugin' }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/plugins/available/$pluginId/$tab',
    component: makeRouteComponent(<PluginDetail />, { action: 'read', resourceType: 'plugin' }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/plugins/installed/$installedId',
    component: makeRouteComponent(<InstalledPluginDetail />, { action: 'read', resourceType: 'plugin' }),
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/plugins/installed/$installedId/$tab',
    component: makeRouteComponent(<InstalledPluginDetail />, { action: 'read', resourceType: 'plugin' }),
  }),
  // Guard against a bare /plugins/available redirect loop; send unknown
  // plugin subpaths back to the marketplace.
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/plugins/available',
    beforeLoad: () => redirect({ to: '/plugins', replace: true }),
  }),
]
