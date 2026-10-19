import { permissionTooltip } from '../../hooks/permissionUtils'
import { useCanI } from '../../hooks/useCanI'

export type PluginPermissions = {
  canCreate: boolean
  canDelete: boolean
  canSync: boolean
  canInstall: boolean
  canUninstall: boolean
  isLoading: boolean
  tooltips: {
    create: string
    delete: string
    sync: string
    install: string
    uninstall: string
  }
}

/**
 * Permission checks for plugin marketplace actions.
 *
 * Checks: plugin:create, plugin:delete, plugin:sync, plugin:install, plugin:uninstall.
 * All values default to `false` (safe-false) until the checks resolve.
 */
export function usePluginPermissions(): PluginPermissions {
  const resourceType = 'plugin'
  const { allowed: canCreate, isChecking: isCheckingCreate } = useCanI('create', resourceType)
  const { allowed: canDelete, isChecking: isCheckingDelete } = useCanI('delete', resourceType)
  const { allowed: canSync, isChecking: isCheckingSync } = useCanI('sync', resourceType)
  const { allowed: canInstall, isChecking: isCheckingInstall } = useCanI('install', resourceType)
  const { allowed: canUninstall, isChecking: isCheckingUninstall } = useCanI('uninstall', resourceType)

  return {
    canCreate,
    canDelete,
    canSync,
    canInstall,
    canUninstall,
    isLoading: isCheckingCreate || isCheckingDelete || isCheckingSync || isCheckingInstall || isCheckingUninstall,
    tooltips: {
      create: permissionTooltip('add a catalog source', `${resourceType}:create`),
      delete: permissionTooltip('delete this catalog source', `${resourceType}:delete`),
      sync: permissionTooltip('synchronize this catalog source', `${resourceType}:sync`),
      install: permissionTooltip('install this plugin', `${resourceType}:install`),
      uninstall: permissionTooltip('uninstall this plugin', `${resourceType}:uninstall`),
    },
  }
}
