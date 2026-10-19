# Server Ping (real code)

Pings a server with a real HTTP GET request. The plugin carries actual
Python code (`steps/ping/implementation.py`) in its OCI artifact — the
Syntara executor extracts and runs it, producing genuine reachability
results with status codes and timing.

## Output

- `reachable` — whether the server responded (true even for 4xx/5xx)
- `status_code` — HTTP status code (when the server responded)
- `response_time_ms` — round-trip time
- `error` — error message when the server is unreachable
- `implementation: "real-python"` — proves real code ran
