/* eslint-disable no-restricted-exports -- route pages are default exports (see the exemption list convention in eslint.config.js) */
import {
  Badge,
  Button,
  Content,
  DescriptionList,
  Flex,
  FlexItem,
  Stack,
  StackItem,
  Tab,
  TabTitleText,
} from '@patternfly/react-core'
import { RhUiCheckCircleIcon, RhUiInstallIcon } from '@patternfly/react-icons'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import { useNavigate, useParams } from '@tanstack/react-router'

import { AppRoute } from '../../app/AppRoute'
import { breadcrumbsPluginDetail, breadcrumbsPluginDetailEarlyShell } from '../../app/breadcrumbBuilders'
import { pluginsClient } from '../../client'
import { SynDetail } from '../../components/details/SynDetail'
import { DisabledWithTooltip } from '../../components/DisabledWithTooltip'
import { SynLabel } from '../../components/labels/SynLabel'
import { SynPage, SynPageBody } from '../../components/layout/SynPage'
import { SynPageHeader } from '../../components/layout/SynPageHeader'
import { SynPanel } from '../../components/layout/SynPanel'
import { SynErrorState } from '../../components/states/SynErrorState'
import { SynLoadingState } from '../../components/states/SynLoadingState'
import { SynPageTitle } from '../../components/SynPageTitle'
import { SynUrlTabs } from '../../components/tabs/SynUrlTabs'
import { useAlerts } from '../../providers/alerts'
import { getErrorMessage } from '../../utils/apiErrors'
import { detachPromise } from '../../utils/detachPromise'
import { useDocLink } from '../../utils/docs/useDocLink'

import { MarkdownView } from './MarkdownView'
import styles from './Plugins.module.css'
import { getPluginDisplayName, RUNTIME_OWNERSHIP_LABELS } from './pluginsUtils'
import { usePluginPermissions } from './usePluginPermissions'

type ActionSummary = {
  identity?: string | null
  display_name?: string | null
  name?: string | null
  description?: string | null
  driver?: string | null
  method?: string | null
  path?: string | null
}

type InstalledSummary = {
  id?: string
  namespace: string
  plugin_name: string
  version: string
  artifact_digest: string
}

/** Resolve how the marketplace plugin relates to the installed set. */
function resolveInstallState(
  installed: InstalledSummary[],
  plugin: { namespace: string; plugin_name: string; artifact_digest: string }
): { match?: InstalledSummary; otherVersion?: InstalledSummary } {
  const byIdentity = installed.filter(
    (candidate) => candidate.namespace === plugin.namespace && candidate.plugin_name === plugin.plugin_name
  )
  const match = byIdentity.find((candidate) => candidate.artifact_digest === plugin.artifact_digest)
  return { match, otherVersion: match ? undefined : byIdentity[0] }
}

function PluginHeaderToolbar({
  installedMatch,
  installedOtherVersion,
  isInstalling,
  onInstall,
  onViewInstallation,
}: Readonly<{
  installedMatch?: InstalledSummary
  installedOtherVersion?: InstalledSummary
  isInstalling: boolean
  onInstall: () => void
  onViewInstallation: (installedId: string) => void
}>) {
  const permissions = usePluginPermissions()

  let statusLabel = null
  if (installedMatch) {
    statusLabel = (
      <FlexItem>
        <SynLabel variant="outline" status="success" icon={<RhUiCheckCircleIcon />}>
          Installed
        </SynLabel>
      </FlexItem>
    )
  } else if (installedOtherVersion) {
    statusLabel = (
      <FlexItem>
        <SynLabel variant="outline" status="warning">
          Other version installed (v{installedOtherVersion.version})
        </SynLabel>
      </FlexItem>
    )
  }

  return (
    <Flex>
      {statusLabel}
      <FlexItem>
        {installedMatch?.id ? (
          <Button variant="secondary" onClick={() => installedMatch.id && onViewInstallation(installedMatch.id)}>
            View installation
          </Button>
        ) : (
          <DisabledWithTooltip isDisabled={!permissions.canInstall} content={permissions.tooltips.install}>
            <Button
              variant="primary"
              icon={<RhUiInstallIcon />}
              isAriaDisabled={!permissions.canInstall}
              isLoading={isInstalling}
              onClick={permissions.canInstall ? onInstall : undefined}
            >
              Install
            </Button>
          </DisabledWithTooltip>
        )}
      </FlexItem>
    </Flex>
  )
}

function ActionsTable({ actions, triggers }: Readonly<{ actions: ActionSummary[]; triggers: ActionSummary[] }>) {
  const steps = [
    ...actions.map((action) => ({ ...action, kind: 'Action' })),
    ...triggers.map((trigger) => ({ ...trigger, kind: 'Trigger' })),
  ]
  if (steps.length === 0) {
    return <Content component="p">This plugin does not declare any actions or triggers.</Content>
  }
  return (
    <Table aria-label="Plugin actions and triggers">
      <Thead>
        <Tr>
          <Th width={20}>Step</Th>
          <Th width={10}>Kind</Th>
          <Th width={30}>Description</Th>
          <Th width={20}>Driver</Th>
          <Th width={20}>Operation</Th>
        </Tr>
      </Thead>
      <Tbody>
        {steps.map((step) => (
          <Tr key={step.identity ?? step.name}>
            <Td dataLabel="Step">{step.display_name ?? step.name}</Td>
            <Td dataLabel="Kind">{step.kind}</Td>
            <Td dataLabel="Description">{step.description ?? '—'}</Td>
            <Td dataLabel="Driver">{step.driver ?? '—'}</Td>
            <Td dataLabel="Operation">
              {step.method ? `${step.method} ` : ''}
              {step.path ?? ''}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  )
}

export default function PluginDetail() {
  const { pluginId }: { pluginId?: string } = useParams({ strict: false })
  const navigate = useNavigate()
  const docLink = useDocLink('plugins')
  const { showAlert } = useAlerts()

  const pluginQuery = pluginsClient.useQuery('get', '/plugins/available/{marketplace_id}', {
    params: { path: { marketplace_id: pluginId ?? '' } },
  })
  const installedQuery = pluginsClient.useQuery('get', '/plugins/installed', {
    params: { query: { limit: 100 } },
  })

  const plugin = pluginQuery.data
  const installed = installedQuery.data?.resources ?? []
  const { match: installedMatch, otherVersion: installedOtherVersion } = plugin
    ? resolveInstallState(installed, plugin)
    : {}

  const { mutate: install, isPending: isInstalling } = pluginsClient.useMutation(
    'post',
    '/plugins/available/{marketplace_id}/install'
  )

  const displayName = plugin ? getPluginDisplayName(plugin) : undefined
  const basePath = pluginId ? AppRoute.Plugins.Detail.replace(':pluginId', pluginId) : '/plugins'

  const handleInstall = () => {
    if (!pluginId) return
    install(
      { params: { path: { marketplace_id: pluginId } } },
      {
        onSuccess: (data) => {
          showAlert({
            title: 'Plugin installed',
            description: data
              ? `${data.display_name ?? data.name} (v${data.version}) passed artifact validation and was installed.`
              : undefined,
            variant: 'success',
            autoDismiss: true,
          })
          detachPromise(installedQuery.refetch())
        },
        onError: (error) => {
          showAlert({
            title: 'Plugin installation failed',
            description: getErrorMessage(error),
            variant: 'danger',
          })
        },
      }
    )
  }

  if (pluginQuery.isPending) {
    return (
      <SynPage>
        <SynPageTitle segments={['Plugins', 'Plugin details']} />
        <SynPageHeader title="Plugin details" breadcrumbs={breadcrumbsPluginDetailEarlyShell()} />
        <SynPageBody>
          <SynLoadingState />
        </SynPageBody>
      </SynPage>
    )
  }

  if (pluginQuery.error || !plugin) {
    return (
      <SynPage>
        <SynPageTitle segments={['Plugins', 'Plugin details']} />
        <SynPageHeader title="Plugin details" breadcrumbs={breadcrumbsPluginDetailEarlyShell()} />
        <SynPageBody>
          <SynErrorState
            message={pluginQuery.error ?? new Error('Plugin not found')}
            onRetry={() => detachPromise(pluginQuery.refetch())}
          />
        </SynPageBody>
      </SynPage>
    )
  }

  return (
    <SynPage>
      <SynPageTitle segments={['Plugins', displayName ?? 'Plugin details']} />
      <SynPageHeader
        title={displayName ?? 'Plugin details'}
        docLink={docLink}
        breadcrumbs={breadcrumbsPluginDetail(displayName ?? 'Plugin details')}
        titleAddons={
          <FlexItem>
            <Badge isRead>{`v${plugin.version}`}</Badge>
          </FlexItem>
        }
        toolbar={
          <PluginHeaderToolbar
            installedMatch={installedMatch}
            installedOtherVersion={installedOtherVersion}
            isInstalling={isInstalling}
            onInstall={handleInstall}
            onViewInstallation={(installedId) =>
              detachPromise(
                navigate({
                  to: AppRoute.Plugins.InstalledDetail.replace(':installedId', installedId),
                })
              )
            }
          />
        }
      />
      <SynPageBody>
        <SynUrlTabs basePath={basePath} defaultTab="overview" validTabs={['overview', 'documentation']}>
          <Tab eventKey="overview" title={<TabTitleText>Overview</TabTitleText>}>
            <Stack hasGutter>
              <StackItem>
                <SynPanel>
                  <DescriptionList isHorizontal>
                    <SynDetail label="Name">{`${plugin.namespace}/${plugin.plugin_name}`}</SynDetail>
                    <SynDetail label="Description">{plugin.description ?? '—'}</SynDetail>
                    <SynDetail label="Version">{plugin.version}</SynDetail>
                    <SynDetail label="Namespace">{plugin.namespace}</SynDetail>
                    <SynDetail label="Runtime ownership">
                      {(plugin.runtime_ownerships ?? []).map((ownership) => (
                        <SynLabel key={ownership} variant="outline">
                          {RUNTIME_OWNERSHIP_LABELS[ownership] ?? ownership}
                        </SynLabel>
                      ))}
                    </SynDetail>
                    <SynDetail label="Artifact repository">{plugin.artifact_repository}</SynDetail>
                    <SynDetail label="Artifact digest">{plugin.artifact_digest}</SynDetail>
                  </DescriptionList>
                </SynPanel>
              </StackItem>
              <StackItem>
                <SynPanel>
                  <ActionsTable actions={plugin.actions ?? []} triggers={plugin.triggers ?? []} />
                </SynPanel>
              </StackItem>
            </Stack>
          </Tab>
          <Tab eventKey="documentation" title={<TabTitleText>Documentation</TabTitleText>}>
            <SynPanel className={styles.documentationPanel}>
              <MarkdownView source={plugin.documentation} />
            </SynPanel>
          </Tab>
        </SynUrlTabs>
      </SynPageBody>
    </SynPage>
  )
}
