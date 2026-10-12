import { Content, ContentVariants, Icon, Spinner } from '@patternfly/react-core'
import {
  RhUiCheckCircleFillIcon,
  RhUiClockIcon,
  RhUiEllipsisHorizontalFillIcon,
  RhUiMinusCircleFillIcon,
  RhUiStopCircleFillIcon,
  RhUiErrorFillIcon,
  RhUiWarningFillIcon,
} from '@patternfly/react-icons'
import { ActivityTypeEnum } from '@syntara/contracts'

import { useElapsedTime } from '../../../hooks/useElapsedTime'
import type { ActivityStatus } from '../../../routes/workflows/execution/types'
import { formatElapsedTime } from '../../../utils/dateUtils'
import { activityStatusColors } from '../executionStatusConstants'

export const EXECUTION_BADGE_DATA_ATTR = 'data-execution-badge'
export const EXECUTION_BADGE_SELECTOR = `[${EXECUTION_BADGE_DATA_ATTR}]`

type ExecutionStatusBadgeProps = {
  status: ActivityStatus
  retryCount?: number
  nodeType?: string
  stallAlertAt?: string
  startedAt?: string
  completedAt?: string
}

type VisualStatus = 'pending' | 'running' | 'waiting' | 'success' | 'error' | 'skipped' | 'cancelled' | 'stalled'

const visualStatusConfig: Record<
  VisualStatus,
  {
    color: string
    node: React.ReactNode
    borderStyle?: React.CSSProperties['borderStyle']
  }
> = {
  pending: {
    color: activityStatusColors.pending,
    node: <RhUiEllipsisHorizontalFillIcon style={{ color: activityStatusColors.pending }} />,
  },
  running: {
    color: activityStatusColors.running,
    node: (
      <Spinner size="lg" style={{ '--pf-v6-c-spinner--Color': activityStatusColors.running } as React.CSSProperties} />
    ),
  },
  waiting: {
    color: activityStatusColors.waiting,
    node: <RhUiClockIcon style={{ color: activityStatusColors.waiting }} />,
  },
  success: {
    color: activityStatusColors.completed,
    node: <RhUiCheckCircleFillIcon style={{ color: activityStatusColors.completed }} />,
  },
  error: {
    color: activityStatusColors.failed,
    node: <RhUiErrorFillIcon style={{ color: activityStatusColors.failed }} />,
  },
  skipped: {
    color: activityStatusColors.skipped,
    node: <RhUiMinusCircleFillIcon style={{ color: activityStatusColors.skipped }} />,
    borderStyle: 'dashed',
  },
  cancelled: {
    color: activityStatusColors.cancelled,
    node: <RhUiStopCircleFillIcon style={{ color: activityStatusColors.cancelled }} />,
  },
  stalled: {
    color: 'var(--pf-t--global--color--status--warning--default)',
    node: <RhUiWarningFillIcon style={{ color: 'var(--pf-t--global--color--status--warning--default)' }} />,
  },
}

function normalizeStatus(status: ActivityStatus, nodeType?: string): { visualStatus: VisualStatus; label: string } {
  switch (status) {
    case 'completed':
      return { visualStatus: 'success', label: 'Success' }
    case 'failed':
      return { visualStatus: 'error', label: 'Error' }
    case 'waiting':
      if (nodeType === ActivityTypeEnum.WAIT) {
        return { visualStatus: 'running', label: 'Running' }
      }
      return { visualStatus: 'waiting', label: 'Waiting for approval' }
    case 'retrying':
      return { visualStatus: 'running', label: 'Retrying' }
    case 'pending':
      return { visualStatus: 'pending', label: 'Pending' }
    case 'running':
      return { visualStatus: 'running', label: 'Running' }
    case 'skipped':
      return { visualStatus: 'skipped', label: 'Skipped' }
    case 'cancelled':
      return { visualStatus: 'cancelled', label: 'Cancelled' }
    default:
      return { visualStatus: 'pending', label: 'Pending' }
  }
}

/**
 * Visual indicator for activity execution status on workflow steps (canvas).
 * Renders as a circular badge positioned in the bottom-right corner of the step.
 * When the activity is live-stalled (running with stall marker), shows elapsed time below the badge.
 */
export function ExecutionStatusBadge({
  status,
  retryCount,
  nodeType,
  stallAlertAt,
  startedAt,
  completedAt,
}: Readonly<ExecutionStatusBadgeProps>) {
  const isLiveStalled = status === 'running' && !!stallAlertAt
  const normalized = isLiveStalled
    ? { visualStatus: 'stalled' as const, label: 'This activity exceeded its expected duration' }
    : normalizeStatus(status, nodeType)
  const config = visualStatusConfig[normalized.visualStatus]
  const title = retryCount ? `${normalized.label} (${retryCount} retries)` : normalized.label

  const { elapsedMs } = useElapsedTime(startedAt, completedAt, status === 'running')
  const showElapsedTime = isLiveStalled && elapsedMs !== undefined

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '-20px',
        right: '-20px',
        width: '48px',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--pf-t--global--background--color--primary--default)',
          borderColor: config.color,
          borderStyle: config.borderStyle ?? 'solid',
          borderWidth: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
        data-execution-badge=""
        title={title}
        role="img"
        aria-label={title}
      >
        {normalized.visualStatus === 'running' ? config.node : <Icon size="xl">{config.node}</Icon>}
      </div>
      {showElapsedTime && (
        <Content
          component={ContentVariants.small}
          style={{
            position: 'absolute',
            // eslint-disable-next-line syntara/use-design-tokens-not-hardcoded -- layout constraint: 48px badge height + 2px gap
            top: '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'var(--pf-t--global--text--color--regular)',
            fontWeight: 'var(--pf-t--global--font--weight--body--bold)',
            fontSize: 'var(--pf-t--global--font--size--xs)',
            fontVariantNumeric: 'tabular-nums',
            margin: 0,
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          {formatElapsedTime(elapsedMs)}
        </Content>
      )}
    </div>
  )
}
