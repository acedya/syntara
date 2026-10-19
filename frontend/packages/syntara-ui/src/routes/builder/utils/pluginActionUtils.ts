import type { PluginsAPI } from '@syntara/contracts'

import type { PluginActionSummary, PluginInputProperty } from '../node-forms/PluginActionForm'

export type InstalledPlugin = PluginsAPI.components['schemas']['InstalledPluginRead']

export type InstalledAction = NonNullable<InstalledPlugin['actions']>[number]

/** Convert a JSON Schema object into the flat property list the form renders. */
export function toInputProperties(schema: unknown): PluginInputProperty[] {
  if (!schema || typeof schema !== 'object') return []
  const properties = (schema as { properties?: Record<string, unknown> }).properties
  if (!properties || typeof properties !== 'object') return []
  const required = new Set((schema as { required?: unknown[] }).required ?? [])
  return Object.entries(properties).map(([name, property]) => {
    const prop = (property ?? {}) as {
      type?: string
      description?: string
      enum?: unknown[]
      default?: unknown
    }
    const enumValues = Array.isArray(prop.enum) ? prop.enum.map((value) => String(value)) : undefined
    const isEnum = enumValues !== undefined
    // Enum fields render as string selects — stringify numeric defaults
    // (YAML parses `enum: [200, 204]` as integers) so they satisfy z.string().
    let defaultValue = prop.default
    if (isEnum && prop.default !== undefined && typeof prop.default !== 'string') {
      defaultValue = JSON.stringify(prop.default)
    }
    return {
      name,
      type: prop.type,
      description: prop.description,
      enumValues,
      defaultValue,
      isRequired: required.has(name),
    }
  })
}

/** Build the form-facing summary for one installed action. */
export function toActionSummary(plugin: InstalledPlugin, action: InstalledAction): PluginActionSummary {
  return {
    identity: String(action.identity ?? action.name ?? ''),
    displayName: String(action.display_name ?? action.name ?? action.identity ?? 'Action'),
    description: action.description ?? null,
    plugin: `${plugin.namespace}/${plugin.plugin_name}`,
    pluginVersion: plugin.version,
    inputProperties: toInputProperties(action.input_schema),
  }
}

/** Find the installed plugin + action for one plugin_action step. */
export function findInstalledAction(
  plugins: InstalledPlugin[],
  pluginIdentity: string,
  actionIdentity: string
): { plugin: InstalledPlugin; action: InstalledAction; summary: PluginActionSummary } | null {
  const namespace = pluginIdentity.split('/')[0]
  const name = pluginIdentity.split('/')[1]
  for (const plugin of plugins) {
    if (plugin.namespace !== namespace || plugin.plugin_name !== name) continue
    for (const action of plugin.actions ?? []) {
      if (action.identity === actionIdentity || action.name === actionIdentity) {
        return { plugin, action, summary: toActionSummary(plugin, action) }
      }
    }
  }
  return null
}
