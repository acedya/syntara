/**
 * Form step respond panel — textarea resize must stay within the form column.
 */
import { test, expect } from '../fixtures'
import { openExecutionFormPromptDeepLink } from '../helpers/formPromptPanel'
import {
  TEXT_AND_TEXTAREA_FORM_DEFINITION,
  createPendingFormStepWorkflow,
  disposeFormPromptWorkflow,
} from '../helpers/formResponses'

const CUSTOM_SUBMIT_LABEL = 'Send form step'
const CUSTOM_FORM_MESSAGE = 'Please complete the form step fields below.'

test.describe('Form step — textarea resize bounds', { tag: '@pr-check' }, () => {
  test('widening the textarea does not expand sibling fields past the form column', async ({ app }) => {
    const created = await createPendingFormStepWorkflow(app, {
      namePrefix: 'e2e-textarea-bounds',
      parameters: {
        message: CUSTOM_FORM_MESSAGE,
        form_definition: TEXT_AND_TEXTAREA_FORM_DEFINITION,
        submit_label: CUSTOM_SUBMIT_LABEL,
      },
    })

    try {
      await openExecutionFormPromptDeepLink(app, created.executionId, created.formPromptId, {
        expectedMessage: CUSTOM_FORM_MESSAGE,
      })

      const summary = app.getByRole('textbox', { name: 'Summary' })
      const details = app.getByRole('textbox', { name: 'Details' })
      const formColumn = app.locator('.form-step-response-form')

      const summaryWidthBefore = await summary.evaluate((element) => element.getBoundingClientRect().width)
      const formColumnWidth = await formColumn.evaluate((element) => element.clientWidth)

      await details.evaluate((textarea) => {
        const control = textarea.parentElement
        if (!control) {
          throw new Error('Expected textarea form-control wrapper')
        }
        control.style.width = '500px'
      })

      await expect
        .poll(async () => summary.evaluate((element) => element.getBoundingClientRect().width))
        .toBe(summaryWidthBefore)

      const textareaShellWidth = await details.evaluate((textarea) => {
        const control = textarea.parentElement
        return control?.getBoundingClientRect().width ?? 0
      })
      expect(textareaShellWidth).toBeLessThanOrEqual(formColumnWidth + 1)
    } finally {
      await disposeFormPromptWorkflow(app, created.workflowId, created.executionId)
    }
  })
})
