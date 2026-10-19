#!/usr/bin/env python3
"""Hello World plugin action — real implementation.

Reads JSON inputs from stdin, writes JSON output to stdout. This code is
extracted from the plugin's OCI artifact content bundle and executed by
the Syntara plugin action executor.
"""

import json
import sys
from datetime import UTC, datetime


def main() -> None:
    inputs = json.loads(sys.stdin.read())
    name = inputs.get("name", "world")
    timestamp = datetime.now(UTC).isoformat()
    greeting = f"Hello, {name}!"
    print(json.dumps({"message": greeting, "greeted_at": timestamp, "implementation": "real-python"}))


if __name__ == "__main__":
    main()
