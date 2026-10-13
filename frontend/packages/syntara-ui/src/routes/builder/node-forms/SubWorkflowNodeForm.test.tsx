import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'

import { SubWorkflowNodeForm, type SubWorkflowFormData } from './SubWorkflowNodeForm'
import { renderWithHeader } from './test-utils/renderWithHeader'

describe('SubWorkflowNodeForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders step name field', () => {
      renderWithHeader(<SubWorkflowNodeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText('Step name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter step name')).toBeInTheDocument()
    })

    it('pre-populates form with initialData', () => {
      const initialData: Partial<SubWorkflowFormData> = {
        name: 'Existing Sub-workflow',
      }

      renderWithHeader(
        <SubWorkflowNodeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} initialData={initialData} />
      )

      expect(screen.getByPlaceholderText('Enter step name')).toHaveValue('Existing Sub-workflow')
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithHeader(<SubWorkflowNodeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Exclude aria-valid-attr-value: PF6 Tabs renders aria-controls pointing to
      // a panel ID that may not exist in the DOM when only the active tab is rendered
      const results = await axe(container, { rules: { 'aria-valid-attr-value': { enabled: false } } })
      expect(results).toHaveNoViolations()
    })
  })

  describe('Form Submission', () => {
    it('submits via requestSubmit with filled data', async () => {
      const user = userEvent.setup()
      renderWithHeader(<SubWorkflowNodeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Fill the form with userEvent
      const nameInput = screen.getByPlaceholderText('Enter step name')
      await user.clear(nameInput)
      await user.type(nameInput, 'My Sub-workflow')

      expect(nameInput).toHaveValue('My Sub-workflow')

      // Trigger submission via requestSubmit (simulates header Create button)
      const form = screen.getByTestId('sub-workflow-node-form')
      ;(form as HTMLFormElement).requestSubmit()

      // Verify onSubmit was called with the form data
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1)
      })

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Sub-workflow',
        }),
        expect.anything()
      )
    })
  })
})
