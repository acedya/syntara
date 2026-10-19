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
import { RhUiCheckCircleIcon, RhUiTrashIcon } from '@patternfly/react-icons'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'

import { AppRoute } from '../../app/AppRoute'
import {
  breadcrumbsInstalledPluginDetail,
  breadcrumbsInstalledPluginDetailEarlyShell,
} from '../../app/breadcrumbBuilders'
import { pluginsClient } from '../../client'
import { SynDetail } from '../../components/details/SynDetail'
import { SynConfirmationDialog } from '../../components/dialogs/SynConfirmationDialog'
import { DisabledWithTooltip } from '../../components/DisabledWithTooltip'
import { SynLabel } from '../../components/labels/SynLabel'
import { SynPage, SynPageBody } from '../../components/layout/SynPage'
import { SynPageHeader } from '../../components/layout/SynPageHeader'
import { SynPanel } from '../../components/layout/SynPanel'
import { SynErrorState } from '../../components/states/SynErrorState'
import { SynLoadingState } from '../../components/states/SynLoadingState'
import { SynPageTitle } from '../../components/SynPageTitle'
import { DateCell } from '../../components/table/DateCell'
import { SynUrlTabs } from '../../components/tabs/SynUrlTabs'
import { useAlerts } from '../../providers/alerts'
import { getErrorMessage } from '../../utils/apiErrors'
import { detachPromise } from '../../utils/detachPromise'
import { useDocLink } from '../../utils/docs/useDocLink'

import { MarkdownView } from './MarkdownView'
import styles from './Plugins.module.css'
import { usePluginPermissions } from './usePluginPermissions'

export default function InstalledPluginDetail() {
  const { installedId }: { installedId?: string } = useParams({ strict: false })
  const navigate = useNavigate()
  const docLink = useDocLink('plugins')
  const permissions = usePluginPermissions()
  const { showAlert } = useAlerts()
  const [isUninstallOpen, setIsUninstallOpen] = useState(false)

  const pluginQuery = pluginsClient.useQuery('get', '/plugins/installed/{installed_id}', {
    params: { path: { installed_id: installedId ?? '' } },
  })

  const { mutate: uninstall, isPending: isUninstalling } = pluginsClient.useMutation(
    'delete',
    '/plugins/installed/{installed_id}'
  )

  const plugin = pluginQuery.data
  const displayName = plugin ? (plugin.display_name ?? plugin.name) : undefined
  const basePath = installedId
    ? AppRoute.Plugins.InstalledDetail.replace(':installedId', installedId)
    : '/plugins/installed'

  const handleUninstall = () => {
    if (!installedId) return
    uninstall(
      { params: { path: { installed_id: installedId } } },
      {
        onSuccess: () => {
          showAlert({
            title: 'Plugin uninstalled',
            variant: 'success',
            autoDismiss: true,
          })
          detachPromise(navigate({ to: AppRoute.Plugins.Installed }))
        },
        onError: (error) => {
          showAlert({
            title: 'Failed to uninstall plugin',
            description: getErrorMessage(error),
            variant: 'danger',
          })
        },
      }
    )
    setIsUninstallOpen(false)
  }

  if (pluginQuery.isPending) {
    return (
      <SynPage>
        <SynPageTitle segments={['Plugins', 'Installed', 'Plugin details']} />
        <SynPageHeader title="Installed plugin" breadcrumbs={breadcrumbsInstalledPluginDetailEarlyShell()} />
        <SynPageBody>
          <SynLoadingState />
        </SynPageBody>
      </SynPage>
    )
  }

  if (pluginQuery.error || !plugin) {
    return (
      <SynPage>
        <SynPageTitle segments={['Plugins', 'Installed', 'Plugin details']} />
        <SynPageHeader title="Installed plugin" breadcrumbs={breadcrumbsInstalledPluginDetailEarlyShell()} />
        <SynPageBody>
          <SynErrorState
            message={pluginQuery.error ?? new Error('Installed plugin not found')}
            onRetry={() => detachPromise(pluginQuery.refetch())}
          />
        </SynPageBody>
      </SynPage>
    )
  }

  return (
    <SynPage>
      <SynPageTitle segments={['Plugins', 'Installed', displayName ?? 'Plugin details']} />
      <SynPageHeader
        title={displayName ?? 'Installed plugin'}
        docLink={docLink}
        breadcrumbs={breadcrumbsInstalledPluginDetail(displayName ?? 'Plugin details')}
        titleAddons={
          <FlexItem>
            <Badge isRead>{`v${plugin.version}`}</Badge>
          </FlexItem>
        }
        toolbar={
          <Flex>
            <FlexItem>
              <SynLabel variant="outline" status="success" icon={<RhUiCheckCircleIcon />}>
                {plugin.status === 'installed' ? 'Installed' : 'Failed'}
              </SynLabel>
            </FlexItem>
            <FlexItem>
              <DisabledWithTooltip isDisabled={!permissions.canUninstall} content={permissions.tooltips.uninstall}>
                <Button
                  variant="danger"
                  icon={<RhUiTrashIcon />}
                  isAriaDisabled={!permissions.canUninstall}
                  onClick={permissions.canUninstall ? () => setIsUninstallOpen(true) : undefined}
                >
                  Uninstall
                </Button>
              </DisabledWithTooltip>
            </FlexItem>
          </Flex>
        }
      />
      <SynPageBody>
        <SynUrlTabs basePath={basePath} defaultTab="overview" validTabs={['overview', 'documentation', 'validation']}>
          <Tab eventKey="overview" title={<TabTitleText>Overview</TabTitleText>}>
            <Stack hasGutter>
              <StackItem>
                <SynPanel>
                  <DescriptionList isHorizontal>
                    <SynDetail label="Name">{`${plugin.namespace}/${plugin.plugin_name}`}</SynDetail>
                    <SynDetail label="Description">{plugin.description ?? '—'}</SynDetail>
                    <SynDetail label="Version">{plugin.version}</SynDetail>
                    <SynDetail label="Artifact repository">{plugin.artifact_repository}</SynDetail>
                    <SynDetail label="Artifact digest">{plugin.artifact_digest}</SynDetail>
                    <SynDetail label="Installed">
                      <DateCell dateString={plugin.installed_at} />
                    </SynDetail>
                  </DescriptionList>
                </SynPanel>
              </StackItem>
              <StackItem>
                <SynPanel>
                  <StepsTable actions={plugin.actions ?? []} triggers={plugin.triggers ?? []} />
                </SynPanel>
              </StackItem>
            </Stack>
          </Tab>
          <Tab eventKey="documentation" title={<TabTitleText>Documentation</TabTitleText>}>
            <SynPanel className={styles.documentationPanel}>
              <MarkdownView source={plugin.documentation} />
            </SynPanel>
          </Tab>
          <Tab eventKey="validation" title={<TabTitleText>Validation</TabTitleText>}>
            <SynPanel className={styles.validationList}>
              <ValidationReport report={plugin.validation_report ?? []} />
            </SynPanel>
          </Tab>
        </SynUrlTabs>
      </SynPageBody>

      <SynConfirmationDialog
        isOpen={isUninstallOpen}
        onClose={() => setIsUninstallOpen(false)}
        onConfirm={handleUninstall}
        title="Uninstall plugin?"
        confirmLabel="Uninstall"
        confirmVariant="danger"
        titleIconVariant="warning"
        confirmLoading={isUninstalling}
      >
        {displayName} (v{plugin.version}) will be removed from Syntara.
      </SynConfirmationDialog>
    </SynPage>
  )
}

type ValidationCheck = {
  check?: string | null
  status?: string | null
  detail?: string | null
}

function ValidationReport({ report }: { report: ValidationCheck[] }) {
  if (report.length === 0) {
    return <Content component="p">No validation report was recorded for this installation.</Content>
  }
  return (
    <Table aria-label="Artifact validation report">
      <Thead>
        <Tr>
          <Th width={30}>Check</Th>
          <Th width={15}>Result</Th>
          <Th width={50}>Detail</Th>
        </Tr>
      </Thead>
      <Tbody>
        {report.map((check, index) => (
          <Tr key={check.check ?? index}>
            <Td dataLabel="Check">{check.check}</Td>
            <Td dataLabel="Result">
              <SynLabel variant="outline" status={check.status === 'passed' ? 'success' : 'danger'}>
                {check.status === 'passed' ? 'Passed' : (check.status ?? '—')}
              </SynLabel>
            </Td>
            <Td dataLabel="Detail">{check.detail || '—'}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  )
}

type StepSummary = {
  identity?: string | null
  display_name?: string | null
  name?: string | null
  description?: string | null
  driver?: string | null
  method?: string | null
  path?: string | null
}

function StepsTable({ actions, triggers }: { actions: StepSummary[]; triggers: StepSummary[] }) {
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
