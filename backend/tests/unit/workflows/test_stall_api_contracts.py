"""Unit tests for AAP-92826 stall detection API contract fields.

Validates that stall_alert_at and first_stall_detected_at are correctly
propagated through ActivityData, ExecutionRead, the activity update publisher,
and the execution service conversion.
"""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import uuid4

from syntara.workflows.models.execution import ActivityData, ExecutionRead, ExecutionStatus

FIXED_STALL_TS = datetime(2026, 10, 7, 12, 0, 0, tzinfo=UTC)
FIXED_FIRST_STALL_TS = datetime(2026, 10, 7, 11, 55, 0, tzinfo=UTC)
FIXED_STARTED_AT = datetime(2026, 10, 7, 11, 0, 0, tzinfo=UTC)


class TestActivityDataStallField:
    """ActivityData includes nullable stall_alert_at."""

    def test_stall_alert_at_defaults_to_none(self) -> None:
        data = ActivityData(activity_id="step-1", status="running")
        assert data.stall_alert_at is None

    def test_stall_alert_at_set(self) -> None:
        data = ActivityData(
            activity_id="step-1",
            status="running",
            stall_alert_at=FIXED_STALL_TS,
        )
        assert data.stall_alert_at == FIXED_STALL_TS

    def test_stall_alert_at_serialized_in_json(self) -> None:
        data = ActivityData(
            activity_id="step-1",
            status="running",
            stall_alert_at=FIXED_STALL_TS,
        )
        dumped = data.model_dump(mode="json")
        assert "stall_alert_at" in dumped
        assert dumped["stall_alert_at"] == "2026-10-07T12:00:00Z"

    def test_stall_alert_at_null_serialized(self) -> None:
        data = ActivityData(activity_id="step-1", status="completed")
        dumped = data.model_dump(mode="json")
        assert dumped["stall_alert_at"] is None


class TestExecutionReadStallFields:
    """ExecutionRead includes first_stall_detected_at."""

    def _minimal_execution_read(self, **overrides: object) -> ExecutionRead:
        defaults: dict = {
            "id": uuid4(),
            "workflow_id": uuid4(),
            "workflow_version_id": uuid4(),
            "project_id": uuid4(),
            "temporal_workflow_id": "temporal-123",
            "status": ExecutionStatus.RUNNING,
            "created_at": FIXED_STARTED_AT,
            "updated_at": FIXED_STARTED_AT,
            "completed_at": None,
            "error_details": None,
            "input_data": {},
        }
        defaults.update(overrides)
        return ExecutionRead(**defaults)

    def test_first_stall_detected_at_defaults_to_none(self) -> None:
        result = self._minimal_execution_read()
        assert result.first_stall_detected_at is None

    def test_first_stall_detected_at_set(self) -> None:
        result = self._minimal_execution_read(first_stall_detected_at=FIXED_FIRST_STALL_TS)
        assert result.first_stall_detected_at == FIXED_FIRST_STALL_TS

    def test_first_stall_detected_at_serialized(self) -> None:
        result = self._minimal_execution_read(first_stall_detected_at=FIXED_FIRST_STALL_TS)
        dumped = result.model_dump(mode="json")
        assert dumped["first_stall_detected_at"] == "2026-10-07T11:55:00Z"


class TestActivityUpdatePublisherStallField:
    """_convert_activity_to_data includes stall_alert_at from ActivityExecution."""

    def test_stall_alert_at_propagated(self) -> None:
        from syntara.workflows.services.activity_update_publisher import ActivityUpdatePublisher

        publisher = ActivityUpdatePublisher.__new__(ActivityUpdatePublisher)

        activity = MagicMock()
        activity.activity_name = "step-1"
        activity.status = "running"
        activity.started_at = FIXED_STARTED_AT
        activity.completed_at = None
        activity.error_details = None
        activity.output_data = None
        activity.iteration = None
        activity.stall_alert_at = FIXED_STALL_TS

        result = publisher._convert_activity_to_data(activity)

        assert result["stall_alert_at"] == "2026-10-07T12:00:00Z"

    def test_stall_alert_at_null_when_not_stalled(self) -> None:
        from syntara.workflows.services.activity_update_publisher import ActivityUpdatePublisher

        publisher = ActivityUpdatePublisher.__new__(ActivityUpdatePublisher)

        activity = MagicMock()
        activity.activity_name = "step-1"
        activity.status = "running"
        activity.started_at = FIXED_STARTED_AT
        activity.completed_at = None
        activity.error_details = None
        activity.output_data = None
        activity.iteration = None
        activity.stall_alert_at = None

        result = publisher._convert_activity_to_data(activity)

        assert result["stall_alert_at"] is None


class TestExecutionServiceStallFields:
    """convert_resource propagates first_stall_detected_at and activity stall_alert_at."""

    def _make_resource(self, *, first_stall_detected_at: datetime | None = None) -> MagicMock:
        resource = MagicMock()
        resource.id = uuid4()
        resource.workflow_id = uuid4()
        resource.workflow_version_id = uuid4()
        resource.project_id = uuid4()
        resource.temporal_workflow_id = "temporal-456"
        resource.status = ExecutionStatus.RUNNING
        resource.created_by = uuid4()
        resource.created_at = FIXED_STARTED_AT
        resource.completed_at = None
        resource.updated_at = FIXED_STARTED_AT
        resource.updated_by = None
        resource.input_data = {}
        resource.trigger_node_id = None
        resource.error_details = None
        resource.labels = {}
        resource.approval_pending = False
        resource.first_stall_detected_at = first_stall_detected_at
        resource.mode = "standard"
        resource.execution_metadata = None
        resource.retried_from_execution_id = None
        resource.trigger_type = None
        resource.interface = None

        wv = MagicMock()
        wv.version = 1
        wv.name = None
        wv.created_at = FIXED_STARTED_AT
        resource.workflow_version = wv

        wf = MagicMock()
        wf.name = "Test Workflow"
        resource.workflow = wf

        resource.activities = []

        return resource

    def test_first_stall_detected_at_propagated(self) -> None:
        from syntara.workflows.services.execution_service import ExecutionsConvertResourceMixin

        converter = ExecutionsConvertResourceMixin()
        resource = self._make_resource(first_stall_detected_at=FIXED_FIRST_STALL_TS)

        result = converter.convert_resource(resource)

        assert result.first_stall_detected_at == FIXED_FIRST_STALL_TS

    def test_activities_include_stall_alert_at(self) -> None:
        """When include=activities, stall_alert_at is propagated."""
        from syntara.workflows.services.execution_service import (
            ExecutionInclude,
            ExecutionsConvertResourceMixin,
        )

        converter = ExecutionsConvertResourceMixin(include={ExecutionInclude.ACTIVITIES})
        resource = self._make_resource()

        activity = MagicMock()
        activity.activity_name = "step-1"
        activity.status = MagicMock()
        activity.status.value = "running"
        activity.error_details = None
        activity.output_data = None
        activity.started_at = FIXED_STARTED_AT
        activity.completed_at = None
        activity.iteration = None
        activity.stall_alert_at = FIXED_STALL_TS
        resource.activities = [activity]

        result = converter.convert_resource(resource)

        assert result.activities is not None
        assert len(result.activities) == 1
        assert result.activities[0].stall_alert_at == FIXED_STALL_TS
