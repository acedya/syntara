import { createServer } from '@mswjs/http-middleware'
import type { Server } from 'http'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { handlers } from './handlers'
import { formPrompts } from './resources/formPrompts'

type JsonObject = Record<string, unknown>

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requireJsonObject = (value: unknown, description: string): JsonObject => {
  if (!isJsonObject(value)) {
    throw new Error(`Expected ${description} to be a JSON object`)
  }
  return value
}

const requireString = (object: JsonObject, field: string): string => {
  const value = object[field]
  if (typeof value !== 'string') {
    throw new Error(`Expected ${field} to be a string`)
  }
  return value
}

const requireBoolean = (object: JsonObject, field: string): boolean => {
  const value = object[field]
  if (typeof value !== 'boolean') {
    throw new Error(`Expected ${field} to be a boolean`)
  }
  return value
}

let server: Server
let baseUrl: string
let workflowSequence = 0
const createdWorkflowIds: string[] = []

beforeAll(async () => {
  const app = createServer(...handlers) as unknown as { listen: (port: number) => Server }
  server = app.listen(0)
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('mock API did not bind a TCP port')
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterEach(async () => {
  for (const workflowId of createdWorkflowIds.splice(0)) {
    const response = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, { method: 'DELETE' })
    expect(response.status).toBe(204)
  }
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
})

const readResponseObject = async (response: Response, description: string): Promise<JsonObject> => {
  const body: unknown = await response.json()
  return requireJsonObject(body, description)
}

const listFormPrompts = async (filters: Record<string, string>): Promise<JsonObject[]> => {
  const url = new URL('/api/v1/form_prompts', baseUrl)
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url)
  expect(response.status).toBe(200)
  const body = await readResponseObject(response, 'form prompt list response')
  const resources = body['resources']
  if (!Array.isArray(resources)) {
    throw new Error('Expected form prompt list response resources to be an array')
  }
  const rows: unknown[] = resources
  return rows.map((resource, index) => requireJsonObject(resource, `form prompt row ${index}`))
}

const postJson = (path: string, body: JsonObject): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const createPromptExecution = async (options: { includeApproval?: boolean } = {}) => {
  workflowSequence += 1
  const workflowName = `form-prompt-handler-contract-${workflowSequence}`
  const nodes = [
    ...(options.includeApproval
      ? [{ id: 'approval_1', type: 'approval', name: 'Approval', parameters: {} }]
      : []),
    {
      id: 'form_prompt_1',
      type: 'form_prompt',
      name: 'Collect response',
      parameters: {
        message: 'Provide a response',
        form_definition: {
          fields: [{ value_name: 'answer', type: 'text', label: 'Answer', required: true }],
        },
      },
    },
  ]
  const workflowResponse = await postJson('/api/v1/workflows', {
    name: workflowName,
    project_id: 'p-001',
    workflow_definition: {
      schema_version: '2.0.0',
      triggers: [{ id: 'trigger_1', type: 'manual_trigger', name: 'Manual trigger', parameters: {} }],
      nodes,
      edges: [],
    },
  })
  expect(workflowResponse.status).toBe(201)
  const workflow = await readResponseObject(workflowResponse, 'workflow create response')
  const workflowId = requireString(workflow, 'id')
  createdWorkflowIds.push(workflowId)

  const executionResponse = await postJson('/api/v1/executions', { workflow_id: workflowId })
  expect(executionResponse.status).toBe(201)
  const execution = await readResponseObject(executionResponse, 'execution create response')
  const executionId = requireString(execution, 'id')
  const promptRows = await listFormPrompts({ execution_id: executionId, status: 'pending', limit: '100' })
  expect(promptRows).toHaveLength(1)
  const prompt = promptRows[0]
  if (!prompt) throw new Error('Expected the created execution to have one form prompt')

  return {
    approvalPending: requireBoolean(execution, 'approval_pending'),
    executionId,
    formPromptId: requireString(prompt, 'id'),
    status: requireString(execution, 'status'),
    workflowId,
    workflowName,
  }
}

describe('form prompt handler contracts', () => {
  it('keeps a form-only wait out of approval state and links the list row to its workflow', async () => {
    // Arrange
    const created = await createPromptExecution()

    // Act
    const rows = await listFormPrompts({ execution_id: created.executionId, limit: '100' })

    // Assert
    expect(created.status).toBe('paused')
    expect(created.approvalPending).toBe(false)
    expect(rows).toHaveLength(1)
    const [prompt] = rows
    if (!prompt) throw new Error('Expected the created execution to have one form prompt')
    expect(prompt['workflow_id']).toBe(created.workflowId)
    expect(prompt['workflow_name']).toBe(created.workflowName)
    expect(prompt['workflow_version']).toBe(1)
    expect(prompt['execution_id']).toBe(created.executionId)
  })

  it('marks a paused execution as approval-pending when it contains an approval step', async () => {
    // Arrange
    const created = await createPromptExecution({ includeApproval: true })

    // Assert
    expect(created.status).toBe('paused')
    expect(created.approvalPending).toBe(true)
  })

  it('preserves a submitted seed across reads and intersects exact and status-list filters', async () => {
    // Use a bundled row to guard against GET handlers resetting seed state after submission.
    const seed = formPrompts.find((prompt) => prompt.id === 'fp-exec-form-prompt-1')
    if (!seed) throw new Error('Expected the pending form prompt seed to exist')
    const seedId = seed.id
    if (typeof seedId !== 'string') throw new Error('Expected the pending form prompt seed to have an ID')
    const originalSeed = structuredClone(seed)

    try {
      // Arrange
      Object.assign(seed, {
        status: 'pending',
        response_data: null,
        responded_at: null,
        responded_by: null,
        updated_at: seed.created_at,
      })

      // Act
      const submitResponse = await postJson(`/api/v1/form_prompts/${seedId}/submit`, {
        response_data: { answer: 'submitted once' },
      })
      expect(submitResponse.status).toBe(200)
      const submitted = await readResponseObject(submitResponse, 'form prompt submit response')

      const detailResponse = await fetch(`${baseUrl}/api/v1/form_prompts/${seedId}`)
      expect(detailResponse.status).toBe(200)
      const detail = await readResponseObject(detailResponse, 'form prompt detail response')

      const matchingRows = await listFormPrompts({
        execution_id: seed.execution_id,
        status: 'submitted',
        'status[in]': 'pending,submitted',
        limit: '100',
      })
      const conflictingRows = await listFormPrompts({
        execution_id: seed.execution_id,
        status: 'pending',
        'status[in]': 'submitted',
        limit: '100',
      })

      // Assert
      expect(submitted['status']).toBe('submitted')
      expect(detail['status']).toBe('submitted')
      const responseData = requireJsonObject(detail['response_data'], 'form prompt response_data')
      expect(responseData['answer']).toBe('submitted once')
      expect(matchingRows).toHaveLength(1)
      expect(matchingRows.map((row) => row['id'])).toEqual([seedId])
      expect(matchingRows.every((row) => row['status'] === 'submitted')).toBe(true)
      expect(conflictingRows).toHaveLength(0)
    } finally {
      Object.assign(seed, originalSeed)
    }
  })
})
