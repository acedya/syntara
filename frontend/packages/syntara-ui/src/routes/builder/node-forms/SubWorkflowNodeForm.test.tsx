import { screen } from '@testing-library/react'
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
    it('wires auto-submit through header Create action', () => {
      renderWithHeader(<SubWorkflowNodeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Form has formId="sub-workflow-node-form" which connects to header Create button
      // useRegisterAutoSubmit hooks into NodeEditorAutoSubmitContext for header wiring
      const form = screen.getByTestId('sub-workflow-node-form')
      expect(form).toBeInTheDocument()
      expect(form).toHaveAttribute('id', 'sub-workflow-node-form')
    })
  })
})
