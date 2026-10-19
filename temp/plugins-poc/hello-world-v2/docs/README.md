# Hello World (real code)

Greets a person by name. Unlike the platform-runner variant, this plugin
carries real Python code in its OCI artifact content bundle — the Syntara
executor extracts `steps/hello/implementation.py` and runs it, producing a
greeting computed by the plugin's own logic.

## Output

The action returns `message` (the greeting), `greeted_at` (execution
timestamp), and `implementation: "real-python"` to prove real code ran.
