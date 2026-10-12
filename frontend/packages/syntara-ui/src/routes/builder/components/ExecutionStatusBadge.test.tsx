import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'

import { ExecutionStatusBadge } from './ExecutionStatusBadge'

describe('ExecutionStatusBadge', () => {
  it('renders pending status with neutral border', () => {
    render(<ExecutionStatusBadge status="pending" />)

    const badge = screen.getByLabelText('Pending')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--nonstatus--gray--300)')
    expect(style).toContain('border-style: solid')
  })

  it('renders running status with spinner', () => {
    render(<ExecutionStatusBadge status="running" />)

    const badge = screen.getByLabelText('Running')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--brand--default)')
    expect(style).toContain('border-style: solid')

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('maps completed status to success styling', () => {
    render(<ExecutionStatusBadge status="completed" />)

    const badge = screen.getByLabelText('Success')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--status--success--default)')
  })

  it('maps failed status to error styling', () => {
    render(<ExecutionStatusBadge status="failed" />)

    const badge = screen.getByLabelText('Error')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--status--danger--default)')
  })

  it('maps retrying status to running styling with retry label', () => {
    render(<ExecutionStatusBadge status="retrying" retryCount={3} />)

    const badge = screen.getByLabelText('Retrying (3 retries)')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--brand--default)')
  })

  it('displays retry count in title when provided', () => {
    render(<ExecutionStatusBadge status="retrying" retryCount={3} />)

    const badge = screen.getByLabelText('Retrying (3 retries)')
    expect(badge).toHaveAttribute('title', 'Retrying (3 retries)')
  })

  it('renders skipped status with dashed border', () => {
    render(<ExecutionStatusBadge status="skipped" />)

    const badge = screen.getByLabelText('Skipped')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--nonstatus--gray--default)')
    expect(style).toContain('border-style: dashed')
  })

  it('renders waiting status with warning border for approval nodes', () => {
    render(<ExecutionStatusBadge status="waiting" />)

    const badge = screen.getByLabelText('Waiting for approval')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--status--warning--default)')
    expect(style).toContain('border-style: solid')
  })

  it('renders waiting status as running for wait nodes', () => {
    render(<ExecutionStatusBadge status="waiting" nodeType="wait" />)

    const badge = screen.getByLabelText('Running')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--brand--default)')
  })

  it('renders cancelled status with muted border', () => {
    render(<ExecutionStatusBadge status="cancelled" />)

    const badge = screen.getByLabelText('Cancelled')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--nonstatus--gray--300)')
  })

  it('positions badge in bottom-right corner', () => {
    render(<ExecutionStatusBadge status="running" />)

    const badge = screen.getByLabelText('Running')
    // eslint-disable-next-line testing-library/no-node-access -- verifying wrapper positioning structure
    const wrapper = badge.parentElement

    // Wrapper positions the badge group in bottom-right corner
    expect(wrapper).toHaveStyle({ position: 'absolute', bottom: '-20px', right: '-20px' })

    // Badge itself is relatively positioned within wrapper
    expect(badge).toHaveStyle({ position: 'relative' })
  })

  it('renders with correct size', () => {
    render(<ExecutionStatusBadge status="pending" />)

    const badge = screen.getByLabelText('Pending')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('width: 48px')
    expect(style).toContain('height: 48px')
    expect(style).toContain('border-radius: 50%')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<ExecutionStatusBadge status="waiting" />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('ExecutionStatusBadge — stall detection', () => {
  const STALL_TIMESTAMP = '2026-09-15T12:00:00Z'

  it('shows stalled warning when RUNNING with stallAlertAt set', () => {
    render(<ExecutionStatusBadge status="running" stallAlertAt={STALL_TIMESTAMP} />)

    const badge = screen.getByRole('img')
    expect(badge).toHaveAttribute('aria-label', 'This activity exceeded its expected duration')
  })

  it('shows normal Running badge when RUNNING without stallAlertAt', () => {
    render(<ExecutionStatusBadge status="running" />)

    const badge = screen.getByRole('img')
    expect(badge).toHaveAttribute('aria-label', 'Running')
  })

  it.each(['completed', 'failed', 'cancelled', 'skipped', 'pending'] as const)(
    'shows normal %s status when stallAlertAt is set but status is not running',
    (status) => {
      render(<ExecutionStatusBadge status={status} stallAlertAt={STALL_TIMESTAMP} />)

      const badge = screen.getByRole('img')
      expect(badge.getAttribute('aria-label')).not.toContain('exceeded')
    }
  )

  it('stalled badge uses warning border color', () => {
    render(<ExecutionStatusBadge status="running" stallAlertAt={STALL_TIMESTAMP} />)

    const badge = screen.getByRole('img')
    const style = badge.getAttribute('style') ?? ''
    expect(style).toContain('border-color: var(--pf-t--global--color--status--warning--default)')
  })

  it('has no accessibility violations in stalled state', async () => {
    const { container } = render(<ExecutionStatusBadge status="running" stallAlertAt={STALL_TIMESTAMP} />)

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('shows elapsed time counter for live-stalled activity', () => {
    const startedAt = '2026-09-15T10:00:00Z'
    render(<ExecutionStatusBadge status="running" stallAlertAt={STALL_TIMESTAMP} startedAt={startedAt} />)

    expect(screen.getByText(/\d+h \d+m \d+s|\d+m \d+s|\d+s/)).toBeInTheDocument()
  })

  it('does not show elapsed time counter when running without stall marker', () => {
    const startedAt = '2026-09-15T10:00:00Z'
    render(<ExecutionStatusBadge status="running" startedAt={startedAt} />)

    expect(screen.queryByText(/\d+h \d+m \d+s|\d+m \d+s|\d+s/)).not.toBeInTheDocument()
  })

  it('does not show elapsed time counter when stalled but not running', () => {
    const startedAt = '2026-09-15T10:00:00Z'
    const completedAt = '2026-09-15T10:30:00Z'
    render(
      <ExecutionStatusBadge
        status="completed"
        stallAlertAt={STALL_TIMESTAMP}
        startedAt={startedAt}
        completedAt={completedAt}
      />
    )

    expect(screen.queryByText(/\d+h \d+m \d+s|\d+m \d+s|\d+s/)).not.toBeInTheDocument()
  })

  it('does not show elapsed time counter when startedAt is missing', () => {
    render(<ExecutionStatusBadge status="running" stallAlertAt={STALL_TIMESTAMP} />)

    expect(screen.queryByText(/\d+h \d+m \d+s|\d+m \d+s|\d+s/)).not.toBeInTheDocument()
  })

  it('centers elapsed time counter beneath the badge using shared wrapper', () => {
    const startedAt = '2026-09-15T10:00:00Z'
    const { container } = render(
      <ExecutionStatusBadge status="running" stallAlertAt={STALL_TIMESTAMP} startedAt={startedAt} />
    )

    const badge = screen.getByRole('img', { name: /exceeded its expected duration/i })
    const counterText = screen.getByText(/\d+h \d+m \d+s|\d+m \d+s|\d+s/)

    // eslint-disable-next-line testing-library/no-node-access -- verifying wrapper positioning structure
    const wrapper = badge.parentElement
    expect(wrapper).toHaveStyle({ position: 'absolute', right: '-20px', bottom: '-20px', width: '48px' })

    // Counter is rendered with centering styles and theme-aware text color
    expect(counterText).toBeVisible()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- verifying inline styles with CSS variables
    const counter = container.querySelector('[style*="font-variant-numeric: tabular-nums"]')
    expect(counter).toBeInTheDocument()
    const style = counter?.getAttribute('style') ?? ''
    expect(style).toContain('color: var(--pf-t--global--text--color--regular)')
  })
})
