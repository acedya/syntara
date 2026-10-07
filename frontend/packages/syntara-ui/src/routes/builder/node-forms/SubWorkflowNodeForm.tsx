import { Button, Flex, FlexItem, FormGroup, Stack, StackItem, TextInput } from '@patternfly/react-core'
import { useMemo, useState } from 'react'

import type { BaseNodeFormProps } from '../registry/NodeRegistry'
import { useIsVersionView } from '../VersionViewContext'

/**
 * Form data for Sub-workflow step
 *
 * Note: This is a minimal form for palette registration (AAP-91268).
 * Configuration panel with target selector and input mapping will be
 * added in AAP-94089, AAP-94647, and AAP-94648.
 */
export type SubWorkflowFormData = {
  name: string
}

/**
 * Sub-workflow step configuration form
 *
 * AAP-91268: Palette registration only - minimal form with name field.
 * Full configuration (workflow selector, input mapping) is out of scope
 * and will be added in subsequent stories.
 */
export function SubWorkflowNodeForm({
  onSubmit,
  onCancel,
  submitButtonText,
  initialData,
}: BaseNodeFormProps<SubWorkflowFormData>) {
  const [name, setName] = useState(initialData?.name ?? '')
  const isVersionView = useIsVersionView()

  const handleSubmit = () => {
    onSubmit({ name })
  }

  const isValid = useMemo(() => name.trim().length > 0, [name])

  return (
    <Stack hasGutter>
      <StackItem>
        <FormGroup label="Step name" isRequired>
          <TextInput
            id="sub-workflow-name"
            value={name}
            onChange={(_event, value) => setName(value)}
            placeholder="Enter step name"
            type="text"
            aria-label="Step name"
            isDisabled={isVersionView}
          />
        </FormGroup>
      </StackItem>
      <StackItem>
        <Flex justifyContent={{ default: 'justifyContentFlexEnd' }} gap={{ default: 'gapSm' }}>
          <FlexItem>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="primary" onClick={handleSubmit} isDisabled={!isValid}>
              {submitButtonText ?? 'Add Step'}
            </Button>
          </FlexItem>
        </Flex>
      </StackItem>
    </Stack>
  )
}
