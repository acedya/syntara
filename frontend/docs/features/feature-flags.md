# Frontend feature flags

## Strategy

A feature flag controls temporary behavior in the frontend. A flag does not grant permission or protect data. The backend must still check access.

Flags are off by default. The frontend reads flag values when the page starts. Reload the page after you change a value.

Syntara uses a small local module and the Zod package that the frontend already uses. A service SDK such as the [LaunchDarkly React SDK](https://launchdarkly.com/docs/sdk/client-side/react/react-web) needs service settings and network setup. The current browser-only use does not need these. Review this choice if we need to target user groups, collect analytics, or change flags remotely.

Follow [GitLab's feature flag guidance](https://docs.gitlab.com/development/feature_flags/) for default values, owners, and documentation. Remove temporary flags as soon as they are no longer needed. Follow [LaunchDarkly's flag lifecycle guidance](https://launchdarkly.com/docs/eu-docs/guides/flags/technical-debt) and remove the code guarded by a retired flag. Review the flag catalog each January, April, July, and October.

## Use the module

Add each flag name to `FEATURE_FLAG_NAMES` in `src/utils/featureFlags.ts`. TypeScript derives `FeatureFlagName` from this list. It rejects names that are not in the list.

Use `isFeatureFlagEnabled` to check a flag:

```tsx
import { isFeatureFlagEnabled } from '../../utils/featureFlags'

function Example() {
  const showWorkflowBuilderQol = isFeatureFlagEnabled('workflow_builder_qol')
  return showWorkflowBuilderQol ? <span>Feature enabled</span> : null
}
```

The Zod schema uses the same list to check values in `localStorage`. The module uses no overrides if storage is missing, the JSON is invalid, or a name or value fails validation. A flag is on only when its value is the boolean `true`.

The app reads these values once at startup. Reload the page after you change a value.

To turn on a registered flag in the browser developer console:

```js
localStorage.setItem('syntara-ui-feature-flags', JSON.stringify({ workflow_builder_qol: true }))
location.reload()
```

Set the value to `false` to turn the flag off. Remove all overrides to clear them:

```js
localStorage.removeItem('syntara-ui-feature-flags')
location.reload()
```

Do not cast a string to `FeatureFlagName` to skip the TypeScript check. Local storage is a development aid. It is not a security control.

### Gate a route

Use TanStack Router's `beforeLoad` option when a flag controls whether a user can open a route. This works with code-based routes that use `createRoute`. If the flag is off, throw a redirect before the route loads. Also hide the route's navigation link when the flag is off. Users can still enter a URL directly, so keep the route guard. See [TanStack Router's route guard guide](https://tanstack.com/router/latest/docs/guide/authenticated-routes).

Add this option to the route definition:

```tsx
import { redirect } from '@tanstack/react-router'
import { isFeatureFlagEnabled } from '../../utils/featureFlags'

beforeLoad: () => {
  if (!isFeatureFlagEnabled('workflow_builder_qol')) {
    throw redirect({ to: '/workflows', replace: true })
  }
},
```

Use a route guard only when the whole route must be unavailable while the flag is off. The `workflow_builder_qol` proof of concept only controls a small marker. Do not add this guard to the existing workflow builder routes. The flag is off by default, so the guard would block the builder. A client-side guard controls navigation. It does not protect backend data or actions.

## Flag catalog

For each flag, record its purpose, date added, owner, tracking issue, removal condition, and lifecycle. When a flag is no longer needed, remove its name and all code that uses it.

| Name                   | Purpose                                    | Added      | Owner       | Tracking issue                                          | When to remove                                                                                                                   | Lifecycle |
| ---------------------- | ------------------------------------------ | ---------- | ----------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `workflow_builder_qol` | Test marker for the workflow builder flag. | 2026-10-19 | Nick Lemmon | [AAP-97515](https://issues.redhat.com/browse/AAP-97515) | Remove after AAP-96509, AAP-96511, and AAP-96513 ship and no code needs the flag. Remove sooner if we stop the proof of concept. | Temporary |
