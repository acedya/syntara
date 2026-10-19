# Frontend feature flags

## Strategy

A feature flag enables temporary behavior in the frontend. A flag does not grant access or protect data. The backend must still check permissions.

Flags are off unless browser storage sets a registered flag to the boolean value `true`. `FeatureFlagsProvider` reads a snapshot when the app starts. Reload the page after you change a saved value.

## Add and use a flag

Add each flag name to `FEATURE_FLAG_NAMES` in `src/utils/feature-flags.ts`. TypeScript builds `FeatureFlagName` from this list. It rejects names that are not in the list.

Use `useFeatureFlag` in a React component:

```tsx
import { useFeatureFlag } from '../../providers/use-feature-flag'

function Example() {
  const isEnabled = useFeatureFlag('workflow_builder_qol')
  return isEnabled ? <span>Feature enabled</span> : null
}
```

The app provides `FeatureFlagsProvider`. Tests that render a component with this hook must also render the provider.

Do not cast a string to `FeatureFlagName` to skip the TypeScript check.

## Set a local value

Use the browser developer console to turn on a registered flag:

```js
localStorage.setItem('feature-flags', JSON.stringify({ workflow_builder_qol: true }))
location.reload()
```

Set the value to `false` to turn it off:

```js
localStorage.setItem('feature-flags', JSON.stringify({ workflow_builder_qol: false }))
location.reload()
```

Remove saved values to turn all flags off:

```js
localStorage.removeItem('feature-flags')
location.reload()
```

The module checks each name and value in storage. A missing flag is off. Invalid JSON, an unknown name, or a non-boolean value turns all flags off. Only the boolean value `true` turns a flag on.

## Test a flagged component

Set `localStorage` before you render `FeatureFlagsProvider`. The provider reads the values when it mounts. In this example, `Example` is the flagged component from the earlier example.

```tsx
import { render } from '@testing-library/react'

import { FeatureFlagsProvider } from '../../providers/feature-flags-provider'
import { FEATURE_FLAG_STORAGE_KEY } from '../../utils/feature-flags'

localStorage.setItem(FEATURE_FLAG_STORAGE_KEY, JSON.stringify({ workflow_builder_qol: true }))

render(
  <FeatureFlagsProvider>
    <Example />
  </FeatureFlagsProvider>
)
```

Clear the storage key after each test so one test does not affect another.

## Gate a route

Use TanStack Router's `beforeLoad` option when a flag controls access to a route. This works with code-based routes created with `createRoute`; file-based routing is not required. `beforeLoad` runs outside React, so use `isFeatureFlagEnabled` instead of the React hook.

```tsx
import { createRoute, redirect } from '@tanstack/react-router'

import { rootRoute } from './__root'
import { isFeatureFlagEnabled } from '../../utils/feature-flags'

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feature-example',
  beforeLoad: () => {
    if (!isFeatureFlagEnabled('workflow_builder_qol')) {
      throw redirect({ to: '/workflows', replace: true })
    }
  },
  component: Example,
})
```

Hide the route's navigation link when the flag is off. A route guard controls frontend navigation. It does not protect backend data or actions.

The `workflow_builder_qol` proof of concept only controls a small marker. Do not add a guard to the existing workflow builder routes.

## Flag catalog

Remove a flag name and all code that uses it when the flag is no longer needed.

| Name                   | Purpose                                    | Tracking issue | When to remove                                                                                                                   |
| ---------------------- | ------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `workflow_builder_qol` | Test marker for the workflow builder flag. | AAP-97515      | Remove after AAP-96509, AAP-96511, and AAP-96513 ship and no code needs the flag. Remove sooner if we stop the proof of concept. |
