import { RhUiModuleIcon } from '@patternfly/react-icons'

import { pluginsFetchClient } from '../../../../client'
import { useWorkflowStore } from '../../../../stores/useWorkflowStore'
import { PluginActionForm } from '../../node-forms/PluginActionForm'
import { buildNamedActivity } from '../../utils/nodeCreationHelpers'
import { getDefaultNodeBaseName } from '../../utils/nodeNaming'
import { toActionSummary } from '../../utils/pluginActionUtils'
import { NodeRegistry } from '../NodeRegistry'

/** Prefix for dynamically registered plugin node types. */
export const PLUGIN_NODE_ID_PREFIX = 'plugin:'

/**
 * Register one node type per installed plugin, with its actions as subtypes.
 *
 * Dynamic counterpart of the static `register*Node` modules: installed
 * plugins contribute palette entries whose forms are driven by each
 * action's declared input schema. Idempotent — plugins that are no longer
 * installed are unregistered.
 */
export async function syncPluginNodes(): Promise<void> {
  const { data, error } = await pluginsFetchClient.GET('/plugins/installed', {
    params: { query: { limit: 100 } },
  })
  if (error || !data) return

  const seen = new Set<string>()
  for (const plugin of data.resources ?? []) {
    const actions = plugin.actions ?? []
    if (actions.length === 0) continue
    const pluginLabel = plugin.display_name ?? plugin.name
    const nodeId = `${PLUGIN_NODE_ID_PREFIX}${plugin.namespace}/${plugin.plugin_name}`
    seen.add(nodeId)

    NodeRegistry.register({
      id: nodeId,
      label: pluginLabel,
      icon: RhUiModuleIcon,
      category: 'action',
      description: plugin.description ?? undefined,
      keywords: ['plugin', plugin.namespace, plugin.plugin_name, ...actions.map((a) => String(a.display_name ?? ''))],
      order: 60,
      selectionTitle: `Select a ${pluginLabel} action`,
      formComponent: PluginActionForm,
      subtypes: actions.map((action) => {
        const summary = toActionSummary(plugin, action)
        return {
          id: summary.identity,
          label: summary.displayName,
          icon: RhUiModuleIcon,
          description: action.description ?? undefined,
          formTitle: `Configure ${summary.displayName}`,
          formComponent: PluginActionForm,
          formProps: { action: summary },
        }
      }),
      onSubmit: (formData, onSuccess, onError, subtypeId) => {
        try {
          const action = actions.find((candidate) =>
            subtypeId ? String(candidate.identity ?? candidate.name) === subtypeId : true
          )
          if (!action || !subtypeId) {
            onError('Plugin action not found')
            return
          }
          const summary = toActionSummary(plugin, action)
          const data = formData as {
            name?: string
            inputs?: Record<string, unknown>
            origin?: string | null
          }
          const baseName = getDefaultNodeBaseName({
            nodeTypeId: nodeId,
            nodeSubtypeId: subtypeId,
            label: summary.displayName,
          })
          const { activityId, activity } = buildNamedActivity(baseName, data.name, (id, name) => ({
            id,
            type: 'plugin_action',
            name,
            parameters: {
              plugin: `${plugin.namespace}/${plugin.plugin_name}`,
              action: subtypeId,
              inputs: data.inputs ?? {},
              ...(data.origin ? { origin: data.origin } : {}),
            },
          }))
          useWorkflowStore.getState().addActivity(activity)
          onSuccess(activityId)
        } catch (error) {
          onError(error instanceof Error ? error.message : 'Failed to add plugin step')
        }
      },
    })
  }

  for (const node of NodeRegistry.getAll()) {
    if (node.id.startsWith(PLUGIN_NODE_ID_PREFIX) && !seen.has(node.id)) {
      NodeRegistry.unregister(node.id)
    }
  }
}
