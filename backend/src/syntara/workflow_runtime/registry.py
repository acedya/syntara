"""Explicit, versioned registration of business activity handlers."""

import asyncio
import inspect
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, cast

from syntara.workflow_runtime.contracts import ActivityContext, ActivityError, Completed, Deferred

type ActivityOutcome = Completed | Deferred
type ActivityHandler = Callable[[dict[str, Any], ActivityContext], ActivityOutcome | Awaitable[ActivityOutcome]]


@dataclass(frozen=True)
class ActivityDefinition:
    """Immutable business registration; deployment routing belongs elsewhere."""

    name: str
    version: int
    handler: ActivityHandler
    supports_deferred: bool = False

    async def invoke(self, inputs: dict[str, Any], context: ActivityContext) -> ActivityOutcome:
        """Invoke either Python execution style without blocking the event loop."""
        if inspect.iscoroutinefunction(self.handler):
            outcome = await self.handler(inputs, context)
        else:
            outcome = await asyncio.to_thread(self.handler, inputs, context)
            if inspect.isawaitable(outcome):
                outcome = await outcome
        if isinstance(outcome, Completed):
            json.dumps(outcome.output, allow_nan=False)
        elif isinstance(outcome, Deferred):
            if not self.supports_deferred or outcome.completion_ref != context.completion_ref:
                msg = "Handler returned an unauthorized completion reference"
                raise ActivityError(msg)
        else:
            msg = "Handler must return Completed or Deferred"
            raise ActivityError(msg)
        return cast("ActivityOutcome", outcome)


class ActivityRegistry:
    """Registry populated by worker composition, never by workflow replay."""

    def __init__(self) -> None:
        """Create an empty registry."""
        self._definitions: dict[tuple[str, int], ActivityDefinition] = {}

    def register(self, definition: ActivityDefinition) -> None:
        """Register one version, rejecting ambiguous or invalid registrations."""
        key = (definition.name, definition.version)
        if not definition.name or definition.version < 1 or key in self._definitions:
            msg = f"Invalid or duplicate activity registration: {key}"
            raise ValueError(msg)
        self._definitions[key] = definition

    def resolve(self, name: str, version: int) -> ActivityDefinition:
        """Resolve a pinned version or fail explicitly."""
        try:
            return self._definitions[name, version]
        except KeyError as exc:
            msg = f"Activity is not installed: {name}@{version}"
            raise ActivityError(msg, code="UnknownActivity") from exc
