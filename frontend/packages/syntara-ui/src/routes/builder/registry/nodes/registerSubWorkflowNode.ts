import { RhUiTopologyIcon } from '@patternfly/react-icons'

import { RegistryNodeId } from '../../../../constants'
import { createSubWorkflowActivity, useWorkflowStore } from '../../../../stores/useWorkflowStore'
import { type SubWorkflowFormData, SubWorkflowNodeForm } from '../../node-forms/SubWorkflowNodeForm'
import { buildNamedActivity } from '../../utils/nodeCreationHelpers'
import { getDefaultNodeBaseName } from '../../utils/nodeNaming'
import { NodeRegistry } from '../NodeRegistry'

/**
 * Register the Sub-workflow step type
 *
 * AAP-91268: Palette registration only - provides step type icon, label, and canvas factory.
 * Configuration panel (workflow selector, input mapping) is out of scope and will be
 * added in AAP-94089, AAP-94647, and AAP-94648.
 */
export default function registerSubWorkflowNode() {
  NodeRegistry.register<SubWorkflowFormData>({
    id: RegistryNodeId.SUB_WORKFLOW,
    label: 'Sub-workflow',
    icon: RhUiTopologyIcon,
    category: 'action',
    description: 'Call another workflow as a sub-workflow (reference mode)',
    keywords: ['workflow', 'sub', 'child', 'call', 'reference', 'nested', 'reuse'],
    order: 40,
    formComponent: SubWorkflowNodeForm,
    enabled: true,
    onSubmit: (data, onSuccess, onError) => {
      try {
        // Create sub-workflow activity
        const baseName = getDefaultNodeBaseName({
          nodeTypeId: RegistryNodeId.SUB_WORKFLOW,
          label: 'Sub-workflow',
        })
        const { activityId, activity } = buildNamedActivity(baseName, data.name, (id, name) =>
          createSubWorkflowActivity({
            id,
            name,
            // Configuration fields (target_workflow_id, input_mapping) will be added
            // by AAP-94089, AAP-94647, AAP-94648
          })
        )

        // Add to workflow store
        useWorkflowStore.getState().addActivity(activity)
        onSuccess(activityId)
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : 'Failed to add sub-workflow step')
      }
    },
  })
}
