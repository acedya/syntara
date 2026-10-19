import { Button, Form, Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core'
import { RhUiUploadIcon } from '@patternfly/react-icons'
import { useEffect } from 'react'

import { pluginsFetchClient } from '../../client'
import { SynFileField } from '../../components/forms/SynFileField'
import { SynForm } from '../../components/forms/SynForm'
import { useSynForm } from '../../hooks/useSynForm'
import { useAlerts } from '../../providers/alerts'
import { getErrorMessage } from '../../utils/apiErrors'

import { pluginUploadSchema, type PluginUploadFormData } from './pluginUploadSchema'

export type UploadPluginModalProps = {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when the modal is closed (cancel or after success) */
  onClose: () => void
  /** Callback after a successful upload with the installed plugin ID */
  onSuccess: (installedId: string, displayName: string) => void
}

const emptyDefaults: PluginUploadFormData = { file: undefined } as unknown as PluginUploadFormData

/**
 * Upload a locally built .oci.tar plugin archive and install it directly,
 * skipping the registry and catalog entirely (POC convenience flow).
 */
export function UploadPluginModal({ isOpen, onClose, onSuccess }: Readonly<UploadPluginModalProps>) {
  const { showAlert } = useAlerts()

  const form = useSynForm({
    schema: pluginUploadSchema,
    defaultValues: emptyDefaults,
    onClose,
  })
  const { handleSubmit, handleClose, reset } = form

  useEffect(() => {
    if (isOpen) {
      reset(emptyDefaults)
    }
  }, [isOpen, reset])

  const onSubmit = async (data: PluginUploadFormData) => {
    const body = new FormData()
    body.append('file', data.file)
    const { data: result, error } = await pluginsFetchClient.POST('/plugins/upload', {
      body: body as never,
    })
    if (error) {
      showAlert({
        title: 'Plugin upload failed',
        description: getErrorMessage(error),
        variant: 'danger',
      })
      return
    }
    showAlert({
      title: 'Plugin installed',
      description: result
        ? `${result.display_name ?? result.name} (v${result.version}) passed artifact validation and was installed.`
        : undefined,
      variant: 'success',
      autoDismiss: true,
    })
    handleClose()
    if (result?.id) {
      onSuccess(result.id, result.display_name ?? result.name ?? 'Plugin')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} variant="small">
      <ModalHeader
        title="Upload plugin"
        description="Install a plugin directly from a .oci.tar archive built with syntara-plugin build — no registry needed."
      />
      <ModalBody>
        <Form id="plugin-upload-form" onSubmit={handleSubmit(onSubmit)}>
          <SynForm form={form}>
            <SynFileField
              name="file"
              label="Plugin archive"
              fieldId="plugin-upload-file"
              isRequired
              dropzoneProps={{ accept: { 'application/x-tar': ['.oci.tar'] } }}
            />
          </SynForm>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" type="submit" form="plugin-upload-form" icon={<RhUiUploadIcon />}>
          Upload and install
        </Button>
        <Button variant="link" onClick={handleClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  )
}
