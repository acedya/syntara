import { Button, Form, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core'
import { RhUiAddIcon } from '@patternfly/react-icons'
import { useEffect } from 'react'

import { pluginsClient } from '../../client'
import { SynForm } from '../../components/forms/SynForm'
import { SynTextAreaField } from '../../components/forms/SynTextAreaField'
import { SynTextField } from '../../components/forms/SynTextField'
import { useSynForm } from '../../hooks/useSynForm'
import { useAlerts } from '../../providers/alerts'

import {
  catalogSourceFormDefaults,
  catalogSourceFormSchema,
  type CatalogSourceFormData,
} from './catalogSourceFormSchema'

export type AddCatalogSourceModalProps = {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when the modal is closed (cancel or after success) */
  onClose: () => void
  /** Callback after a successful create to refresh sources and sync */
  onSuccess: (sourceId: string) => void
}

export function AddCatalogSourceModal({ isOpen, onClose, onSuccess }: Readonly<AddCatalogSourceModalProps>) {
  const { showAlert } = useAlerts()

  const form = useSynForm({
    schema: catalogSourceFormSchema,
    defaultValues: catalogSourceFormDefaults,
    onClose,
  })
  const { handleSubmit, handleError, handleClose, reset } = form

  useEffect(() => {
    if (isOpen) {
      reset(catalogSourceFormDefaults)
    }
  }, [isOpen, reset])

  const { mutate: createSource, isPending } = pluginsClient.useMutation('post', '/plugins/catalog-sources')

  const onSubmit = (formData: CatalogSourceFormData) => {
    createSource(
      {
        body: {
          name: formData.name,
          description: formData.description || undefined,
          registry_origin: formData.registry_origin,
          repository: formData.repository,
          channel: formData.channel,
          username: formData.username || undefined,
          password: formData.password || undefined,
        },
      },
      {
        onSuccess: (data) => {
          showAlert({
            title: 'Catalog source added',
            description: `Catalog source "${formData.name}" has been added.`,
            variant: 'success',
            autoDismiss: true,
          })
          handleClose()
          if (data?.id) {
            onSuccess(data.id)
          }
        },
        onError: handleError({
          title: 'Failed to add catalog source',
          context: formData.name ? `Catalog source "${formData.name}"` : undefined,
        }),
      }
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} variant="medium">
      <ModalHeader
        title="Add catalog source"
        description="Point Syntara at an OCI registry holding a Syntara plugin catalog index."
      />
      <ModalBody>
        <Form id="catalog-source-form" onSubmit={handleSubmit(onSubmit)}>
          <SynForm form={form}>
            <SynTextField
              name="name"
              label="Name"
              fieldId="catalog-source-name"
              isRequired
              placeholder="local-registry"
            />
            <SynTextField
              name="registry_origin"
              label="Registry origin"
              fieldId="catalog-source-origin"
              isRequired
              placeholder="http://localhost:5000"
            />
            <SynTextField
              name="repository"
              label="Catalog repository"
              fieldId="catalog-source-repository"
              isRequired
              placeholder="example/catalog-index"
            />
            <SynTextField
              name="channel"
              label="Channel"
              fieldId="catalog-source-channel"
              isRequired
              placeholder="stable"
            />
            <SynTextField name="username" label="Username" fieldId="catalog-source-username" placeholder="Optional" />
            <SynTextField
              name="password"
              label="Password"
              fieldId="catalog-source-password"
              type="password"
              placeholder="Optional"
            />
            <SynTextAreaField
              name="description"
              label="Description"
              fieldId="catalog-source-description"
              placeholder="Enter description"
              rows={3}
            />
          </SynForm>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          type="submit"
          form="catalog-source-form"
          isDisabled={isPending}
          isLoading={isPending}
          icon={<RhUiAddIcon />}
        >
          Add source
        </Button>
        <Button variant="link" onClick={handleClose} isDisabled={isPending}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  )
}
