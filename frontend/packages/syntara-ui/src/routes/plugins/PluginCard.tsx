import {
  Badge,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Content,
  Flex,
  FlexItem,
  Truncate,
} from '@patternfly/react-core'
import { RhUiCheckCircleIcon } from '@patternfly/react-icons'
import { useNavigate } from '@tanstack/react-router'

import { SynLabel } from '../../components/labels/SynLabel'

import styles from './Plugins.module.css'
import { getPluginDetailPath, getStepCount, type MarketplacePluginRead } from './pluginsUtils'

type PluginCardProps = {
  plugin: MarketplacePluginRead
  isInstalled: boolean
}

/** One marketplace card, modeled on the OpenShift OperatorHub card grid. */
export function PluginCard({ plugin, isInstalled }: Readonly<PluginCardProps>) {
  const navigate = useNavigate()
  const detailPath = getPluginDetailPath(plugin.id)
  const displayName = plugin.display_name || `${plugin.namespace}/${plugin.plugin_name}`

  return (
    <Card isCompact isClickable className={styles.pluginCard} onClick={() => navigate({ to: detailPath })}>
      <CardHeader
        selectableActions={{
          selectableActionAriaLabel: `View details for ${displayName}`,
        }}
      >
        <CardTitle>
          <Truncate content={displayName} />
        </CardTitle>
      </CardHeader>
      <CardBody>
        <Content component="p" className={styles.pluginCardDescription}>
          {plugin.description ?? 'No description provided.'}
        </Content>
        <Flex alignItems={{ default: 'alignItemsCenter' }} className={styles.pluginCardMeta}>
          <FlexItem>
            <Badge isRead>{plugin.namespace}</Badge>
          </FlexItem>
          <FlexItem>
            <Badge isRead>{`v${plugin.version}`}</Badge>
          </FlexItem>
          <FlexItem>
            <Badge isRead>{`${getStepCount(plugin)} ${getStepCount(plugin) === 1 ? 'step' : 'steps'}`}</Badge>
          </FlexItem>
          {isInstalled && (
            <FlexItem>
              <SynLabel variant="outline" status="success" icon={<RhUiCheckCircleIcon />}>
                Installed
              </SynLabel>
            </FlexItem>
          )}
        </Flex>
      </CardBody>
      <CardFooter className={styles.pluginCardFooter}>
        <Content component="small" className={styles.pluginCardDigest}>
          {plugin.artifact_digest?.slice(0, 19)}…
        </Content>
      </CardFooter>
    </Card>
  )
}
