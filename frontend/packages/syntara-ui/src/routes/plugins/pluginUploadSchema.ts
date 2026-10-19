import { z } from 'zod'

/** Maximum accepted plugin archive size (OCI metadata artifacts are tiny). */
export const MAX_PLUGIN_UPLOAD_FILE_SIZE_BYTES = 64 * 1024 * 1024

export const pluginUploadSchema = z.object({
  file: z
    .instanceof(File, { message: 'Plugin archive is required' })
    .refine((value) => value instanceof File, 'Plugin archive is required')
    .refine((value) => value.size <= MAX_PLUGIN_UPLOAD_FILE_SIZE_BYTES, 'Plugin archive must be 64 MiB or smaller')
    .refine(
      (value) => value.name.endsWith('.oci.tar'),
      'Plugin archive must be a .oci.tar file built with syntara-plugin build'
    ),
})

export type PluginUploadFormData = z.infer<typeof pluginUploadSchema>
