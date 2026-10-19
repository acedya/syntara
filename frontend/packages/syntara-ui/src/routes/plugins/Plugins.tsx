/* eslint-disable no-restricted-exports -- route pages are default exports (see the exemption list convention in eslint.config.js) */
import {
  Button,
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  List,
  ListItem,
  MenuToggle,
  SelectOption,
  Tab,
  TabTitleText,
  Tabs,
  TextInput,
} from '@patternfly/react-core'
import { RhUiAddIcon, RhUiModuleIcon, RhUiSyncIcon, RhUiUploadIcon } from '@patternfly/react-icons'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useMemo, useState, type Ref } from 'react'

import { AppRoute } from '../../app/AppRoute'
import { pluginsClient } from '../../client'
import { SynConfirmationDialog } from '../../components/dialogs/SynConfirmationDialog'
import { DisabledWithTooltip } from '../../components/DisabledWithTooltip'
import { SynPage, SynPageBody } from '../../components/layout/SynPage'
import { SynPageHeader } from '../../components/layout/SynPageHeader'
import { SynEmptyStateNoData } from '../../components/states/SynEmptyStateNoData'
import { SynErrorState } from '../../components/states/SynErrorState'
import { SynLoadingState } from '../../components/states/SynLoadingState'
import { SynPageTitle } from '../../components/SynPageTitle'
import { SynSelect } from '../../components/SynSelect'
import { useAlerts } from '../../providers/alerts'
import { getErrorMessage } from '../../utils/apiErrors'
import { detachPromise } from '../../utils/detachPromise'
import { useDocLink } from '../../utils/docs/useDocLink'

import { AddCatalogSourceModal } from './AddCatalogSourceModal'
import { InstalledTabContent } from './InstalledPluginsTab'
import { PluginCard } from './PluginCard'
import styles from './Plugins.module.css'
import { UploadPluginModal } from './UploadPluginModal'
import { usePluginPermissions } from './usePluginPermissions'

type MarketplaceTab = 'marketplace' | 'installed'

type FilterOption = {
  value: string
  label: string
}

type FilterSelectProps = {
  ariaLabel: string
  placeholder: string
  options: FilterOption[]
  value: string | null
  onChange: (value: string | null) => void
}

/** Single-select filter dropdown with a clearable placeholder (OperatorHub style). */
function FilterSelect({ ariaLabel, placeholder, options, value, onChange }: Readonly<FilterSelectProps>) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedLabel = options.find((option) => option.value === value)?.label

  const toggle = (toggleRef: Ref<HTMLButtonElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={() => setIsOpen(!isOpen)}
      isExpanded={isOpen}
      isFullWidth
      aria-label={ariaLabel}
    >
      {selectedLabel ?? placeholder}
    </MenuToggle>
  )

  return (
    <SynSelect
      aria-label={ariaLabel}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onSelect={(_event, selected) => {
        const selectedValue = String(selected)
        onChange(selectedValue === value ? null : selectedValue)
        setIsOpen(false)
      }}
      toggle={toggle}
    >
      {options.map((option) => (
        <SelectOption key={option.value} value={option.value} isSelected={option.value === value}>
          {option.label}
        </SelectOption>
      ))}
    </SynSelect>
  )
}

type MarketplaceTabContentProps = {
  onAddSource: () => void
  onSync: (sourceId: string) => void
  isSyncing: boolean
}

function MarketplaceTabContent({ onAddSource, onSync, isSyncing }: Readonly<MarketplaceTabContentProps>) {
  const permissions = usePluginPermissions()
  const [search, setSearch] = useState('')
  const [namespaceFilter, setNamespaceFilter] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  const sourcesQuery = pluginsClient.useQuery('get', '/plugins/catalog-sources')
  const marketplaceQuery = pluginsClient.useQuery('get', '/plugins/available', {
    params: { query: { limit: 100 } },
  })
  const installedQuery = pluginsClient.useQuery('get', '/plugins/installed', {
    params: { query: { limit: 100 } },
  })

  const sources = sourcesQuery.data?.resources ?? []
  const installed = useMemo(() => installedQuery.data?.resources ?? [], [installedQuery.data])

  const namespaces = useMemo(
    () => Array.from(new Set((marketplaceQuery.data?.resources ?? []).map((plugin) => plugin.namespace))).sort(),
    [marketplaceQuery.data]
  )

  const installedKeys = useMemo(
    () => new Set(installed.map((plugin) => `${plugin.namespace}/${plugin.plugin_name}@${plugin.artifact_digest}`)),
    [installed]
  )

  const visiblePlugins = useMemo(() => {
    const plugins = marketplaceQuery.data?.resources ?? []
    const needle = search.trim().toLowerCase()
    return plugins.filter((plugin) => {
      if (namespaceFilter && plugin.namespace !== namespaceFilter) return false
      if (sourceFilter && plugin.catalog_source_id !== sourceFilter) return false
      if (!needle) return true
      const haystack = [
        plugin.display_name,
        `${plugin.namespace}/${plugin.plugin_name}`,
        plugin.description,
        plugin.version,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [marketplaceQuery.data, search, namespaceFilter, sourceFilter])

  const selectedSource = sources.find((source) => source.id === sourceFilter) ?? sources[0]

  const isInstalled = (plugin: { namespace: string; plugin_name: string; artifact_digest: string }) =>
    installedKeys.has(`${plugin.namespace}/${plugin.plugin_name}@${plugin.artifact_digest}`)

  if (sourcesQuery.isPending || marketplaceQuery.isPending) {
    return <SynLoadingState />
  }
  if (sourcesQuery.error) {
    return <SynErrorState message={sourcesQuery.error} onRetry={() => detachPromise(sourcesQuery.refetch())} />
  }
  if (marketplaceQuery.error) {
    return <SynErrorState message={marketplaceQuery.error} onRetry={() => detachPromise(marketplaceQuery.refetch())} />
  }
  if (sources.length === 0) {
    return (
      <EmptyState headingLevel="h4" titleText="No catalog sources" icon={RhUiModuleIcon}>
        <EmptyStateBody>
          Add a catalog source pointing at an OCI registry with a Syntara plugin catalog index to browse and install
          plugins.
        </EmptyStateBody>
        <EmptyStateFooter>
          <EmptyStateActions>
            <DisabledWithTooltip isDisabled={!permissions.canCreate} content={permissions.tooltips.create}>
              <Button
                variant="primary"
                icon={<RhUiAddIcon />}
                isAriaDisabled={!permissions.canCreate}
                onClick={permissions.canCreate ? onAddSource : undefined}
              >
                Add catalog source
              </Button>
            </DisabledWithTooltip>
          </EmptyStateActions>
        </EmptyStateFooter>
      </EmptyState>
    )
  }
  if (visiblePlugins.length === 0) {
    return (
      <SynEmptyStateNoData
        title="No plugins available"
        description={
          search || namespaceFilter
            ? 'No plugins match the current filters.'
            : 'The catalog has no entries yet. Synchronize the catalog source to fetch plugins.'
        }
      />
    )
  }
  return (
    <>
      <div className={styles.toolbarRow}>
        <div className={styles.searchInput}>
          <TextInput
            id="plugin-search"
            type="search"
            aria-label="Search plugins"
            placeholder="Search plugins…"
            value={search}
            onChange={(_event, value) => setSearch(value)}
          />
        </div>
        {namespaces.length > 1 && (
          <FilterSelect
            ariaLabel="Filter by namespace"
            placeholder="All namespaces"
            options={namespaces.map((namespace) => ({ value: namespace, label: namespace }))}
            value={namespaceFilter}
            onChange={setNamespaceFilter}
          />
        )}
        {sources.length > 1 && (
          <FilterSelect
            ariaLabel="Filter by catalog source"
            placeholder="All sources"
            options={sources.map((source) => ({ value: source.id ?? '', label: source.name }))}
            value={sourceFilter}
            onChange={setSourceFilter}
          />
        )}
        {selectedSource?.id && (
          <DisabledWithTooltip isDisabled={!permissions.canSync} content={permissions.tooltips.sync}>
            <Button
              variant="secondary"
              icon={<RhUiSyncIcon />}
              isAriaDisabled={!permissions.canSync}
              isLoading={isSyncing}
              onClick={permissions.canSync && selectedSource.id ? () => onSync(selectedSource.id) : undefined}
            >
              Sync {selectedSource.name}
            </Button>
          </DisabledWithTooltip>
        )}
      </div>
      <List isPlain className={styles.pluginGrid} aria-label="Available plugins">
        {visiblePlugins.map((plugin) => (
          <ListItem key={plugin.id}>
            <PluginCard plugin={plugin} isInstalled={isInstalled(plugin)} />
          </ListItem>
        ))}
      </List>
    </>
  )
}

export default function Plugins() {
  const navigate = useNavigate()
  const docLink = useDocLink('plugins')
  const permissions = usePluginPermissions()
  const { showAlert } = useAlerts()

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const activeTab: MarketplaceTab = pathname.startsWith(AppRoute.Plugins.Installed) ? 'installed' : 'marketplace'

  const marketplaceQuery = pluginsClient.useQuery('get', '/plugins/available', {
    params: { query: { limit: 100 } },
  })
  const sourcesQuery = pluginsClient.useQuery('get', '/plugins/catalog-sources')
  const installedQuery = pluginsClient.useQuery('get', '/plugins/installed', {
    params: { query: { limit: 100 } },
  })

  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uninstallTarget, setUninstallTarget] = useState<string | null>(null)

  const { mutate: syncSource, isPending: isSyncing } = pluginsClient.useMutation(
    'post',
    '/plugins/catalog-sources/{source_id}/sync'
  )
  const { mutate: uninstall, isPending: isUninstalling } = pluginsClient.useMutation(
    'delete',
    '/plugins/installed/{installed_id}'
  )

  const installed = useMemo(() => installedQuery.data?.resources ?? [], [installedQuery.data])
  const uninstallCandidate = installed.find((plugin) => plugin.id === uninstallTarget)

  const handleSync = (sourceId: string) => {
    syncSource(
      { params: { path: { source_id: sourceId } } },
      {
        onSuccess: (data) => {
          showAlert({
            title: 'Catalog synchronized',
            description: data ? `Catalog generation ${data.catalog_generation ?? '?'} is now available.` : undefined,
            variant: 'success',
            autoDismiss: true,
          })
          detachPromise(marketplaceQuery.refetch())
        },
        onError: (error) => {
          showAlert({
            title: 'Catalog sync failed',
            description: getErrorMessage(error),
            variant: 'danger',
          })
          detachPromise(sourcesQuery.refetch())
        },
      }
    )
  }

  const handleUninstall = (installedId: string) => {
    uninstall(
      { params: { path: { installed_id: installedId } } },
      {
        onSuccess: () => {
          showAlert({
            title: 'Plugin uninstalled',
            variant: 'success',
            autoDismiss: true,
          })
          detachPromise(installedQuery.refetch())
          detachPromise(marketplaceQuery.refetch())
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
    setUninstallTarget(null)
  }

  return (
    <SynPage>
      <SynPageTitle segments={['Plugins']} />
      <SynPageHeader
        title="Plugins"
        docLink={docLink}
        toolbar={
          activeTab === 'marketplace' ? (
            <>
              <DisabledWithTooltip isDisabled={!permissions.canInstall} content={permissions.tooltips.install}>
                <Button
                  variant="secondary"
                  icon={<RhUiUploadIcon />}
                  isAriaDisabled={!permissions.canInstall}
                  onClick={permissions.canInstall ? () => setIsUploadOpen(true) : undefined}
                >
                  Upload plugin
                </Button>
              </DisabledWithTooltip>
              <DisabledWithTooltip isDisabled={!permissions.canCreate} content={permissions.tooltips.create}>
                <Button
                  variant="primary"
                  icon={<RhUiAddIcon />}
                  isAriaDisabled={!permissions.canCreate}
                  onClick={permissions.canCreate ? () => setIsAddSourceOpen(true) : undefined}
                >
                  Add catalog source
                </Button>
              </DisabledWithTooltip>
            </>
          ) : undefined
        }
      />

      <SynPageBody>
        <Tabs
          activeKey={activeTab}
          onSelect={(_event, key) =>
            detachPromise(navigate({ to: key === 'installed' ? AppRoute.Plugins.Installed : AppRoute.Plugins.Root }))
          }
        >
          <Tab eventKey="marketplace" title={<TabTitleText>Marketplace</TabTitleText>}>
            <MarketplaceTabContent
              onAddSource={() => setIsAddSourceOpen(true)}
              onSync={handleSync}
              isSyncing={isSyncing}
            />
          </Tab>
          <Tab eventKey="installed" title={<TabTitleText>Installed</TabTitleText>}>
            <InstalledTabContent onUninstall={setUninstallTarget} />
          </Tab>
        </Tabs>
      </SynPageBody>

      <UploadPluginModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={(installedId) => {
          detachPromise(installedQuery.refetch())
          detachPromise(marketplaceQuery.refetch())
          detachPromise(
            navigate({
              to: AppRoute.Plugins.InstalledDetail.replace(':installedId', installedId),
            })
          )
        }}
      />

      <AddCatalogSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        onSuccess={(sourceId) => {
          detachPromise(sourcesQuery.refetch())
          if (permissions.canSync) {
            handleSync(sourceId)
          }
        }}
      />

      <SynConfirmationDialog
        isOpen={Boolean(uninstallTarget)}
        onClose={() => setUninstallTarget(null)}
        onConfirm={() => uninstallTarget && handleUninstall(uninstallTarget)}
        title="Uninstall plugin?"
        confirmLabel="Uninstall"
        confirmVariant="danger"
        titleIconVariant="warning"
        confirmLoading={isUninstalling}
      >
        <Content>
          {uninstallCandidate
            ? `${uninstallCandidate.display_name ?? uninstallCandidate.name} (v${uninstallCandidate.version}) will be removed from Syntara.`
            : 'The plugin will be removed from Syntara.'}
        </Content>
      </SynConfirmationDialog>
    </SynPage>
  )
}
