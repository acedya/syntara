# Frontend feature flags

## Purpose

The Syntara UI feature flag framework gates temporary frontend behavior. It does not grant permissions or protect data. Backend authorization remains the security boundary.

The first registered flag, `workflow_builder_qol`, only displays a small test proof of concept in the workflow builder. The workflow builder redesign stories [AAP-96509](https://issues.redhat.com/browse/AAP-96509), [AAP-96511](https://issues.redhat.com/browse/AAP-96511), and [AAP-96513](https://issues.redhat.com/browse/AAP-96513) can use the framework when that work begins.

## Library choice and lifecycle guidance

The frontend has no dedicated feature flag SDK. A service-backed option such as the [LaunchDarkly React SDK](https://launchdarkly.com/docs/sdk/client-side/react/react-web) supports centrally managed, context-based flags, but it requires a client-side ID and context and initializes against LaunchDarkly. This ticket needs only browser-local toggles and explicitly excludes network configuration. The implementation is therefore a small Syntara module using the Zod dependency already present in the frontend. It does not add a service or flag SDK. Reconsider this choice if the product later needs central targeting, analytics, or remote rollout control.

The [GitLab feature flag guidance](https://docs.gitlab.com/development/feature_flags/) recommends default-off flags, registered names, an owner, clear documentation, and keeping temporary flags in the codebase for as little time as possible. The [LaunchDarkly lifecycle guidance](https://launchdarkly.com/docs/eu-docs/guides/flags/technical-debt) recommends planning cleanup when a temporary flag is introduced and removing code references before archiving a flag. Syntara applies those ideas with a typed registry and the catalog below. Because Syntara has no remote flag archive, cleanup means removing the registered name and all guarded code in the same change. The quarterly review is a Syntara process choice to catch flags whose stated removal conditions have been met.

## Implementation

The flag names are declared in `src/utils/featureFlags.ts` as a readonly TypeScript tuple. `FeatureFlagName` is inferred from that tuple, and `isFeatureFlagEnabled` accepts only that union. Adding a check for an unregistered name is a TypeScript error. Add a name to the tuple before using it in application code.

The same tuple defines the Zod schema for browser storage. This first version uses browser-local overrides so a developer can exercise a flag without backend configuration. On application startup, the UI reads the `syntara-ui-feature-flags` localStorage entry once and validates the complete object. Missing storage, malformed JSON, unknown flag names, or non-boolean values disable all flags. Only the boolean value `true` enables a registered flag. The startup snapshot remains in effect until the page is reloaded.

Zod's enum and partial-record schemas keep runtime storage validation aligned with the registered names: [Zod API: enum and partial-record schemas](https://zod.dev/api?id=zpartialrecord).

## Local proof of concept

Set a registered flag in the browser developer console, then reload the page:

```js
localStorage.setItem('syntara-ui-feature-flags', JSON.stringify({ workflow_builder_qol: true }))
location.reload()
```

Turn it off by setting the value to `false`, or remove the override:

```js
localStorage.removeItem('syntara-ui-feature-flags')
location.reload()
```

Local storage is a development aid, not a security control. Users can change it in their browser.

## Adding a flag

1. Add the name to `FEATURE_FLAG_NAMES`. This updates the `FeatureFlagName` union and the runtime storage schema.
2. Add the flag's default-off behavior and keep every call to `isFeatureFlagEnabled` typed with a registered name.
3. Add or update tests for the default-off behavior, enabled behavior, and the UI gated by the flag.
4. Add a catalog entry below with the purpose, owner, creation date, tracking issue, and removal condition.

Do not cast arbitrary strings to `FeatureFlagName` to bypass the type check.

## Flag catalog and lifecycle

Review this catalog in January, April, July, and October. Each review should confirm the owner, active consumers, and removal condition. Remove a temporary flag and its guarded code when the condition is met; do not leave completed flags in the registry.

| Name                   | Purpose                                                                                | Added      | Owner       | Tracking                                                | Removal condition                                                                                                                       | Lifecycle |
| ---------------------- | -------------------------------------------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `workflow_builder_qol` | Test-only marker proving the client-side flag framework works in the workflow builder. | 2026-10-19 | Nick Lemmon | [AAP-97515](https://issues.redhat.com/browse/AAP-97515) | Remove after AAP-96509, AAP-96511, and AAP-96513 ship and no consumer needs the switch, or remove if the proof of concept is abandoned. | Temporary |
