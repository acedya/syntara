/** Installed-plugins tab for the Plugins page. */
import { RhUiTrashIcon } from '@patternfly/react-icons'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'

import { pluginsClient } from '../../client'
import { IconLabel } from '../../components/IconLabel'
import { SynLabel } from '../../components/labels/SynLabel'
import { SynPanel } from '../../components/layout/SynPanel'
import { SynEmptyStateNoData } from '../../components/states/SynEmptyStateNoData'
import { SynErrorState } from '../../components/states/SynErrorState'
import { SynLoadingState } from '../../components/states/SynLoadingState'
import { SynKebabMenu } from '../../components/SynKebabMenu'
import { DateCell } from '../../components/table/DateCell'
import { LinkCell } from '../../components/table/LinkCell'
import { detachPromise } from '../../utils/detachPromise'

import { getInstalledPluginDetailPath, shortDigest } from './pluginsUtils'
import { usePluginPermissions } from './usePluginPermissions'

export function InstalledTabContent({ onUninstall }: Readonly<{ onUninstall: (installedId: string) => void }>) {
  const permissions = usePluginPermissions()
  const installedQuery = pluginsClient.useQuery('get', '/plugins/installed', {
    params: { query: { limit: 100 } },
  })
  const installed = installedQuery.data?.resources ?? []

  if (installedQuery.isPending) {
    return <SynLoadingState />
  }
  if (installedQuery.error) {
    return <SynErrorState message={installedQuery.error} onRetry={() => detachPromise(installedQuery.refetch())} />
  }
  if (installed.length === 0) {
    return (
      <SynEmptyStateNoData
        title="No plugins installed"
        description="Install a plugin from the marketplace to see it here."
      />
    )
  }
  return (
    <SynPanel>
      <Table aria-label="Installed plugins">
        <Thead>
          <Tr>
            <Th width={25}>Plugin</Th>
            <Th width={10}>Version</Th>
            <Th width={15}>Status</Th>
            <Th width={20}>Artifact</Th>
            <Th width={15}>Installed</Th>
            <Th width={10} screenReaderText="Actions" />
          </Tr>
        </Thead>
        <Tbody>
          {installed.map((plugin) => (
            <Tr key={plugin.id}>
              <Td dataLabel="Plugin">
                <LinkCell href={getInstalledPluginDetailPath(plugin.id)}>{plugin.display_name ?? plugin.name}</LinkCell>
              </Td>
              <Td dataLabel="Version">{plugin.version}</Td>
              <Td dataLabel="Status">
                <SynLabel variant="outline" status={plugin.status === 'installed' ? 'success' : 'danger'}>
                  {plugin.status === 'installed' ? 'Installed' : 'Failed'}
                </SynLabel>
              </Td>
              <Td dataLabel="Artifact">{shortDigest(plugin.artifact_digest)}</Td>
              <Td dataLabel="Installed">
                <DateCell dateString={plugin.installed_at} />
              </Td>
              <Td isActionCell>
                <SynKebabMenu
                  aria-label={`Actions for ${plugin.name}`}
                  actions={[
                    {
                      key: 'uninstall',
                      title: <IconLabel icon={<RhUiTrashIcon />}>Uninstall plugin</IconLabel>,
                      isDanger: true,
                      isAriaDisabled: !permissions.canUninstall,
                      tooltipProps: permissions.canUninstall ? undefined : { content: permissions.tooltips.uninstall },
                      onClick: permissions.canUninstall && plugin.id ? () => onUninstall(plugin.id) : undefined,
                    },
                  ]}
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </SynPanel>
  )
}
