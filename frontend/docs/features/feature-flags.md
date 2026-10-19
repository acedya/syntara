# Frontend feature flags

## Strategy

Feature flags gate temporary client-side behavior. They do not grant permissions or protect data; backend authorization remains the security boundary. Flags default to off, and local changes take effect after a page reload.

Syntara uses a small local module with the frontend's existing Zod dependency. A third-party SDK such as the [LaunchDarkly React SDK](https://launchdarkly.com/docs/sdk/client-side/react/react-web) would add service configuration and network initialization that this browser-local workflow does not need. Revisit that choice if flags need central targeting, analytics, or remote rollout.

This approach follows [GitLab's feature flag guidance](https://docs.gitlab.com/development/feature_flags/) on default-off values, ownership, documentation, and removing temporary flags promptly. It also applies [LaunchDarkly's lifecycle guidance](https://launchdarkly.com/docs/eu-docs/guides/flags/technical-debt): remove guarded code when a temporary flag is no longer needed. Review the catalog each January, April, July, and October.

## Using the module

Register names in `src/utils/featureFlags.ts`. The `FeatureFlagName` TypeScript union is inferred from this list, so a caller cannot check an unregistered name. Import `isFeatureFlagEnabled` from that module to guard UI behavior:

```tsx
import { isFeatureFlagEnabled } from '../../utils/featureFlags'

function Example() {
  const showWorkflowBuilderQol = isFeatureFlagEnabled('workflow_builder_qol')
  return showWorkflowBuilderQol ? <span>Feature enabled</span> : null
}
```

The same registered names define the Zod schema for browser storage. Missing storage, malformed JSON, unknown names, or non-boolean values disable the overrides. Only the boolean value `true` enables a flag. The UI reads the stored overrides once at startup, so reload after changing them.

To enable a registered flag from the browser developer console:

```js
localStorage.setItem('syntara-ui-feature-flags', JSON.stringify({ workflow_builder_qol: true }))
location.reload()
```

Set its value to `false` to turn it off, or remove all local overrides:

```js
localStorage.removeItem('syntara-ui-feature-flags')
location.reload()
```

Do not cast arbitrary strings to `FeatureFlagName` to bypass the TypeScript check. Local storage is a development aid, not a security control.

### Gating a route

Use TanStack Router's `beforeLoad` option when a flag controls whether a route can be opened. A redirect stops the guarded route from loading; hide its navigation link with the same flag so the UI does not offer a dead link. TanStack Router runs `beforeLoad` before loading child routes and supports redirects from it ([route guards](https://tanstack.com/router/latest/docs/guide/authenticated-routes)).

Add the typed flag check to the route definition:

```tsx
import { redirect } from '@tanstack/react-router'
import { isFeatureFlagEnabled } from '../../utils/featureFlags'

beforeLoad: () => {
  if (!isFeatureFlagEnabled('workflow_builder_qol')) {
    throw redirect({ to: '/workflows', replace: true })
  }
},
```

Use the route guard only when the route itself should be unavailable while the flag is off. The `workflow_builder_qol` proof of concept currently gates a small marker only; adding this guard to the existing workflow builder routes would hide the builder by default. A client-side route guard controls navigation experience, not access to backend data or operations.

## Flag catalog

When adding a flag, document its purpose, date, owner, tracking issue, removal condition, and lifecycle. Remove the registered name and all guarded code together when the flag is no longer needed.

| Name                   | Purpose                                                                                | Added      | Owner       | Tracking                                                | Removal condition                                                                                                                | Lifecycle |
| ---------------------- | -------------------------------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `workflow_builder_qol` | Test-only marker proving the client-side flag framework works in the workflow builder. | 2026-10-19 | Nick Lemmon | [AAP-97515](https://issues.redhat.com/browse/AAP-97515) | Remove after AAP-96509, AAP-96511, and AAP-96513 ship and no consumer needs the switch, or if the proof of concept is abandoned. | Temporary |
