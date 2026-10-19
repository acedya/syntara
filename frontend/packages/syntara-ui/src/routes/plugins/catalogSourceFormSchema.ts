import { z } from 'zod'

export type CatalogSourceFormData = z.infer<typeof catalogSourceFormSchema>

export const catalogSourceFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255, 'Name must be 255 characters or fewer'),
  description: z.string().trim().max(2000, 'Description must be 2000 characters or fewer').optional(),
  registry_origin: z
    .string()
    .trim()
    .min(1, 'Registry origin is required')
    .url('Registry origin must be a URL, e.g. http://localhost:5000'),
  repository: z.string().trim().min(1, 'Repository is required').max(255, 'Repository must be 255 characters or fewer'),
  channel: z.string().trim().min(1, 'Channel is required').max(255),
  username: z.string().trim().max(255).optional(),
  password: z.string().max(255).optional(),
})

export const catalogSourceFormDefaults: CatalogSourceFormData = {
  name: '',
  description: '',
  registry_origin: 'http://localhost:5000',
  repository: 'example/catalog-index',
  channel: 'stable',
  username: '',
  password: '',
}
