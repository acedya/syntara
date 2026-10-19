import { Content, DescriptionList, Spinner, Stack, StackItem } from '@patternfly/react-core'
import type { Activity } from '@syntara/contracts'

import { pluginsClient } from '../../../client'
import { SynDetail } from '../../../components/details/SynDetail'
import { SynPanel } from '../../../components/layout/SynPanel'
import { useWorkflowStore } from '../../../stores/useWorkflowStore'
import { PluginActionForm } from '../node-forms/PluginActionForm'
import { findInstalledAction } from '../utils/pluginActionUtils'

type PluginActionDetailsProps = {
  taskData: Activity
  nodeId: string
  onClose: () => void
}

type PluginActionParameters = {
  plugin?: string
  action?: string
  inputs?: Record<string, unknown>
  origin?: string | null
}

/**
 * Editable details for a plugin action step.
 *
 * Loads the installed plugin's declared input schema and renders the same
 * schema-driven form used when the step was created, pre-filled with the
 * current values. Falls back to a read-only summary when the plugin is no
 * longer installed (the step can still run against its saved inputs).
 */
export function PluginActionDetails({ taskData, nodeId, onClose }: Readonly<PluginActionDetailsProps>) {
  const parameters = (taskData.parameters ?? {}) as PluginActionParameters
  const updateActivity = useWorkflowStore((state) => state.updateActivity)

  const installedQuery = pluginsClient.useQuery('get', '/plugins/installed', {
    params: { query: { limit: 100 } },
  })

  const plugins = installedQuery.data?.resources ?? []
  const match = findInstalledAction(plugins, String(parameters.plugin ?? ''), String(parameters.action ?? ''))

  if (installedQuery.isPending) {
    return (
      <SynPanel style={{ padding: 'var(--pf-t--global--spacer--lg)' }}>
        <Spinner size="lg" />
      </SynPanel>
    )
  }

  if (!match) {
    return (
      <SynPanel style={{ padding: 'var(--pf-t--global--spacer--md)', overflowY: 'auto' }}>
        <Stack hasGutter>
          <StackItem>
            <Content component="p">
              The plugin for this step is no longer installed, so its inputs cannot be edited here. The step keeps its
              saved inputs and will still run.
            </Content>
          </StackItem>
          <StackItem>
            <DescriptionList isHorizontal>
              <SynDetail label="Step name">{taskData.name ?? '—'}</SynDetail>
              <SynDetail label="Plugin">{parameters.plugin ?? '—'}</SynDetail>
              <SynDetail label="Action">{parameters.action ?? '—'}</SynDetail>
              <SynDetail label="Inputs">
                {Object.keys(parameters.inputs ?? {}).length > 0 ? (
                  <DescriptionList isHorizontal>
                    {Object.entries(parameters.inputs ?? {}).map(([key, value]) => (
                      <SynDetail key={key} label={key}>
                        {typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
                          ? `${String(value)}`
                          : JSON.stringify(value)}
                      </SynDetail>
                    ))}
                  </DescriptionList>
                ) : (
                  '—'
                )}
              </SynDetail>
            </DescriptionList>
          </StackItem>
        </Stack>
      </SynPanel>
    )
  }

  return (
    <PluginActionForm
      action={match.summary}
      onCancel={onClose}
      initialData={{
        name: taskData.name,
        inputs: parameters.inputs ?? {},
        origin: parameters.origin ?? null,
      }}
      onSubmit={(data) => {
        updateActivity(nodeId, {
          name: data.name,
          parameters: {
            plugin: parameters.plugin,
            action: parameters.action,
            inputs: data.inputs,
            ...(data.origin ? { origin: data.origin } : {}),
          },
        })
        onClose()
      }}
    />
  )
}
