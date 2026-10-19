# Plugin Marketplace POC

A proof of concept for installing and running Syntara plugins from OCI
artifacts, with an OperatorHub-style marketplace UI and **real Python code
execution from the artifact content bundle**.

**Not for merging as-is** — this is a POC for team review.

## What it demonstrates

1. **Plugin marketplace** (OperatorHub-style): browse catalog sources, sync,
   install plugins with a 10-check artifact validation pipeline
2. **Direct upload**: drag-and-drop a `.oci.tar` to install without a registry
3. **Real code execution**: plugin steps run actual Python code extracted
   from the OCI artifact — hello-world computes a real greeting, server-ping
   performs a real HTTP reachability check
4. **Workflow builder integration**: installed plugins appear as palette
   entries with schema-driven forms; steps are editable after creation

## The plugin model

A plugin is an OCI metadata artifact (`application/vnd.syntara.plugin.v1`)
containing:

- **PluginDescriptor** — identity, actions, input/output JSON Schemas
- **Content bundle** (tar.gz) — schemas, docs, and the Python implementation
- **Config** — digest bindings for validation

The `plugin_action` workflow node type carries `{plugin, action, inputs,
origin}`. At install time, Syntara validates the artifact and extracts the
implementation source code. At run time, the executor validates inputs
against the declared JSON Schema and runs the code in a Python subprocess
(JSON stdin → JSON stdout).

## Demo plugins

Two plugins with real implementations:

| Plugin | Action | What it does |
|---|---|---|
| `example/hello-world` | Say hello | Computes a greeting from the input name |
| `tools/server-ping` | Ping server | Performs a real HTTP request and reports reachability |

Build them with:

```sh
python3 temp/plugins-poc/build-plugin-artifact.py temp/plugins-poc/hello-world-v2 dist/hello-world.oci.tar
python3 temp/plugins-poc/build-plugin-artifact.py temp/plugins-poc/server-ping-v2 dist/server-ping.oci.tar
```

Pre-built archives are included in each plugin's `dist/` directory.

## Quick start

1. Start Syntara (backend on :8000, UI on :5173 or :8080)
2. Open **Plugins** in the left navigation
3. Click **Upload plugin** → pick `hello-world-v2/dist/hello-world.oci.tar`
4. The plugin installs with a validation report (10 checks)
5. Open the **workflow builder** → Add step → **Hello World** → **Say hello**
6. Fill the input name → Create → Save → Run
7. The step output shows `message: "Hello, <name>!"` — real code output

## API

```
GET/POST   /plugins/catalog-sources          — manage catalog sources
POST       /plugins/catalog-sources/{id}/sync — sync from registry
GET        /plugins/available                 — browse marketplace
GET        /plugins/available/{id}            — plugin details
POST       /plugins/available/{id}/install    — install from marketplace
POST       /plugins/upload                    — install from .oci.tar (multipart)
GET        /plugins/installed                 — list installed
GET/DELETE /plugins/installed/{id}            — detail / uninstall
```

## Verification

The feature was verified end-to-end: API-level lifecycle tests (46
assertions), UI flows (marketplace browse, upload, install, workflow
builder, execution), and real-code output validation. See
[verification/VERIFICATION.md](verification/VERIFICATION.md) for the full
report.

## Known POC shortcuts

- Registry credentials stored in plain text
- HTTP allowed for loopback registries
- Implementation code runs in a subprocess without sandboxing
- No plugin Execution Plane (container ABI) — code runs via Python subprocess
- Editing plugin step inputs after creation re-renders the form but doesn't
  diff against the original values
