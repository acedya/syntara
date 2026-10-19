#!/usr/bin/env python3
"""Server Ping plugin action — real implementation.

Performs an actual HTTP GET against the target host and reports whether
the server responded, with status code and round-trip timing. This code
is extracted from the plugin's OCI artifact content bundle.
"""

import json
import sys
import time
import urllib.error
import urllib.request


def main() -> None:
    inputs = json.loads(sys.stdin.read())
    host = inputs.get("host", "")
    timeout = inputs.get("timeout_seconds", 5)

    if not host.startswith("http://") and not host.startswith("https://"):
        url = f"https://{host}"
    else:
        url = host

    started = time.perf_counter()
    try:
        request = urllib.request.Request(url, method="GET", headers={"User-Agent": "syntara-plugin-ping/0.2.0"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            print(json.dumps({
                "reachable": True,
                "status_code": response.status,
                "response_time_ms": elapsed_ms,
                "url": url,
                "implementation": "real-python",
            }))
    except urllib.error.HTTPError as error:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        print(json.dumps({
            "reachable": True,
            "status_code": error.code,
            "response_time_ms": elapsed_ms,
            "url": url,
            "implementation": "real-python",
        }))
    except Exception as error:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        print(json.dumps({
            "reachable": False,
            "response_time_ms": elapsed_ms,
            "url": url,
            "error": str(error),
            "implementation": "real-python",
        }))


if __name__ == "__main__":
    main()
