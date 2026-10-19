/**
 * Mock plugin marketplace resources for the standalone mock API.
 *
 * Mirrors the shape served by the backend plugins API: one seeded catalog
 * source pointing at the local development registry, marketplace entries for
 * the demo plugins, and one already-installed plugin.
 */

import { mockDate } from './mockDates'

const sourceId = '11111111-1111-4111-8111-111111111111'
const helloWorldId = '22222222-2222-4222-8222-222222222222'
const httpNotifierId = '33333333-3333-4333-8333-333333333333'
const slackAnnouncerId = '44444444-4444-4444-8444-444444444444'
const installedHelloId = '55555555-5555-4555-8555-555555555555'

export type MockCatalogSource = {
  id: string
  name: string
  description: string | null
  registry_origin: string
  repository: string
  channel: string
  username: string | null
  has_credentials: boolean
  sync_status: string
  sync_error: string | null
  last_synced_at: string | null
  catalog_generation: number | null
  labels: Record<string, string>
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export const pluginCatalogSources: MockCatalogSource[] = [
  {
    id: sourceId,
    name: 'local-registry',
    description: 'Local development plugin registry seeded by default',
    registry_origin: 'http://localhost:5000',
    repository: 'example/catalog-index',
    channel: 'stable',
    username: null,
    has_credentials: false,
    sync_status: 'synced',
    sync_error: null,
    last_synced_at: mockDate.hoursAgo1,
    catalog_generation: 3,
    labels: {},
    created_at: mockDate.daysAgo2,
    updated_at: mockDate.hoursAgo1,
    created_by: '00000000-0000-4000-8000-000000000001',
    updated_by: '00000000-0000-4000-8000-000000000001',
  },
]

const helloAction = {
  identity: 'example.hello-world.hello',
  name: 'hello',
  display_name: 'Say hello',
  description: "Returns a greeting through Syntara's managed HTTP runner.",
  runtime_kind: 'platform-runner',
  driver: 'http.v1',
  method: 'GET',
  path: '/hello/{input.name}',
}

export const marketplacePlugins = [
  {
    id: helloWorldId,
    catalog_source_id: sourceId,
    namespace: 'example',
    plugin_name: 'hello-world',
    version: '0.1.0',
    display_name: 'Hello World',
    description: 'Small, credentialless plugin for learning the Syntara SDK.',
    artifact_repository: 'example/plugins/hello-world',
    artifact_digest: 'sha256:c6cb2f7c8466799fa4ae1874651321bcf19459980650aa7b4342fc7145cb0cec',
    documentation_digest: 'sha256:6f4f31401d71dd13314848a9f1d9676c03d0524e684d240519137b9028c02904',
    runtime_ownerships: ['platform-runner'],
    is_deprecated: false,
    is_withdrawn: false,
    actions: [helloAction],
    triggers: [],
    documentation:
      '# Hello World\n\nThis plugin contributes one credentialless `platform-runner` action: **Say hello**.\n\n## Usage\n\n1. Install the plugin.\n2. Add the **Say hello** action to a workflow.\n3. Provide a name and receive a greeting.\n',
    catalog_generation: 3,
    synced_at: mockDate.hoursAgo1,
    labels: {},
    created_at: mockDate.daysAgo2,
    updated_at: mockDate.hoursAgo1,
  },
  {
    id: httpNotifierId,
    catalog_source_id: sourceId,
    namespace: 'example',
    plugin_name: 'http-notifier',
    version: '0.2.0',
    display_name: 'HTTP Notifier',
    description: 'Send webhook notifications to any HTTP endpoint when workflows complete or fail.',
    artifact_repository: 'example/plugins/http-notifier',
    artifact_digest: 'sha256:2e816b4cc88615ae6ae051cd644f77b5f9d90c3d4f0b70210aed42d173055772',
    documentation_digest: 'sha256:2526c360a8159178496f18b169619f0aadb739a8fcd7c0f4430e1e7605102d58',
    runtime_ownerships: ['platform-runner'],
    is_deprecated: false,
    is_withdrawn: false,
    actions: [
      {
        identity: 'example.http-notifier.notify',
        name: 'notify',
        display_name: 'Send notification',
        description: 'Deliver a JSON payload to a webhook endpoint with optional retry.',
        runtime_kind: 'platform-runner',
        driver: 'http.v1',
        method: 'POST',
        path: '/notify/{input.channel}',
      },
    ],
    triggers: [],
    documentation:
      '# HTTP Notifier\n\nSend webhook notifications to any HTTP endpoint from Syntara workflows.\n\n## Actions\n\n### Send notification\n\nDelivers a JSON payload to `POST /notify/{channel}`.\n',
    catalog_generation: 3,
    synced_at: mockDate.hoursAgo1,
    labels: {},
    created_at: mockDate.daysAgo2,
    updated_at: mockDate.hoursAgo1,
  },
  {
    id: slackAnnouncerId,
    catalog_source_id: sourceId,
    namespace: 'acme',
    plugin_name: 'slack-announcer',
    version: '0.3.1',
    display_name: 'Slack Announcer',
    description: 'Post workflow updates to Slack channels and look up channel identifiers.',
    artifact_repository: 'acme/plugins/slack-announcer',
    artifact_digest: 'sha256:cc9e52536ef7a272d43e67d5702dd9225948c4e26797489604eda1b16e870767',
    documentation_digest: 'sha256:8f67a88f909a18ac60490d29302b949560d77cb14db4b0b39a8e524c4f404654',
    runtime_ownerships: ['platform-runner'],
    is_deprecated: false,
    is_withdrawn: false,
    actions: [
      {
        identity: 'acme.slack-announcer.post-message',
        name: 'post-message',
        display_name: 'Post message',
        description: 'Send a formatted message to a Slack channel.',
        runtime_kind: 'platform-runner',
        driver: 'http.v1',
        method: 'POST',
        path: '/chat.postMessage',
      },
      {
        identity: 'acme.slack-announcer.list-channels',
        name: 'list-channels',
        display_name: 'List channels',
        description: 'List Slack channels visible to the configured bot token.',
        runtime_kind: 'platform-runner',
        driver: 'http.v1',
        method: 'GET',
        path: '/conversations.list',
      },
    ],
    triggers: [],
    documentation:
      '# Slack Announcer\n\nPost workflow updates to Slack and inspect available channels.\n\n## Actions\n\n- **Post message** — send a formatted message to a channel.\n- **List channels** — list channels visible to the bot token.\n',
    catalog_generation: 3,
    synced_at: mockDate.hoursAgo1,
    labels: {},
    created_at: mockDate.daysAgo2,
    updated_at: mockDate.hoursAgo1,
  },
]

export type MockInstalledPlugin = {
  id: string
  name: string
  description: string | null
  namespace: string
  plugin_name: string
  version: string
  display_name: string
  artifact_repository: string
  artifact_digest: string
  catalog_source_id: string
  status: string
  actions: Array<Record<string, unknown>>
  triggers: Array<Record<string, unknown>>
  installed_at: string
  labels: Record<string, string>
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  descriptor: Record<string, unknown>
  documentation: string
  validation_report: Array<{ check: string; status: string; detail: string }>
}

export const installedPlugins: MockInstalledPlugin[] = [
  {
    id: installedHelloId,
    name: 'example/hello-world',
    description: 'Small, credentialless plugin for learning the Syntara SDK.',
    namespace: 'example',
    plugin_name: 'hello-world',
    version: '0.1.0',
    display_name: 'Hello World',
    artifact_repository: 'example/plugins/hello-world',
    artifact_digest: 'sha256:c6cb2f7c8466799fa4ae1874651321bcf19459980650aa7b4342fc7145cb0cec',
    catalog_source_id: sourceId,
    status: 'installed',
    actions: [helloAction],
    triggers: [],
    installed_at: mockDate.hoursAgo1,
    labels: {},
    created_at: mockDate.hoursAgo1,
    updated_at: mockDate.hoursAgo1,
    created_by: '00000000-0000-4000-8000-000000000001',
    updated_by: '00000000-0000-4000-8000-000000000001',
    descriptor: {},
    documentation:
      '# Hello World\n\nThis plugin contributes one credentialless `platform-runner` action: **Say hello**.\n',
    validation_report: [
      { check: 'artifact-fetch', status: 'passed', detail: 'fetched example/plugins/hello-world' },
      { check: 'artifact-type', status: 'passed', detail: 'artifact is a Syntara plugin metadata artifact' },
      { check: 'manifest-digest', status: 'passed', detail: 'manifest digest matches the catalog entry' },
      { check: 'documentation-digest', status: 'passed', detail: "documentation 'docs/README.md' digest verified" },
    ],
  },
]

export const mockPluginValidationReport = installedPlugins[0].validation_report
