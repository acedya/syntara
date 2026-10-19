import type { PluginsAPI } from '@syntara/contracts'

import { AppRoute } from '../../app/AppRoute'

export type MarketplacePluginRead = PluginsAPI.components['schemas']['MarketplacePluginRead']
export type InstalledPluginRead = PluginsAPI.components['schemas']['InstalledPluginRead']
export type PluginCatalogSourceRead = PluginsAPI.components['schemas']['PluginCatalogSourceRead']

/** Build the detail route for one marketplace plugin. */
export function getPluginDetailPath(pluginId: string | undefined): string {
  return AppRoute.Plugins.Detail.replace(':pluginId', pluginId ?? '')
}

/** Build the detail route for one installed plugin. */
export function getInstalledPluginDetailPath(installedId: string | undefined): string {
  return AppRoute.Plugins.InstalledDetail.replace(':installedId', installedId ?? '')
}

/** Format an OCI digest for compact display. */
export function shortDigest(digest: string | null | undefined): string {
  if (!digest) return '—'
  return digest.length > 19 ? `${digest.slice(0, 19)}…` : digest
}

/** Total number of actions and triggers contributed by a plugin. */
export function getStepCount(plugin: { actions?: unknown[]; triggers?: unknown[] } | undefined): number {
  return (plugin?.actions?.length ?? 0) + (plugin?.triggers?.length ?? 0)
}

/** Display label for a marketplace or installed plugin. */
export function getPluginDisplayName(
  plugin: { display_name?: string | null; name?: string | null } | undefined
): string {
  return plugin?.display_name || plugin?.name || 'Unnamed plugin'
}

/** Human label for runtime ownership badges. */
export const RUNTIME_OWNERSHIP_LABELS: Record<string, string> = {
  'platform-runner': 'Platform runner',
  'custom-workload': 'Custom workload',
}
