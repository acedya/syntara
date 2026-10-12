"""Unit tests for AAP-92826 stall detection API contract fields.

Validates that stall_alert_at, is_stalled, and first_stall_detected_at are
correctly propagated through ActivityData, ExecutionRead, the activity update
publisher, and the execution service conversion.

Includes a database-backed test class (TestIsStalledColumnProperty) that
exercises the correlated EXISTS aggregate with real ORM queries.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from syntara.workflows.models.execution import ActivityData, Execution, ExecutionRead, ExecutionStatus

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

    from syntara.core.models import User

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
    """ExecutionRead includes is_stalled and first_stall_detected_at."""

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

    def test_is_stalled_defaults_to_false(self) -> None:
        result = self._minimal_execution_read()
        assert result.is_stalled is False

    def test_is_stalled_set_true(self) -> None:
        result = self._minimal_execution_read(is_stalled=True)
        assert result.is_stalled is True

    def test_is_stalled_serialized(self) -> None:
        result = self._minimal_execution_read(is_stalled=True)
        dumped = result.model_dump(mode="json")
        assert dumped["is_stalled"] is True

    def test_first_stall_detected_at_defaults_to_none(self) -> None:
        result = self._minimal_execution_read()
        assert result.first_stall_detected_at is None

    def test_first_stall_detected_at_set(self) -> None:
        result = self._minimal_execution_read(first_stall_detected_at=FIXED_FIRST_STALL_TS)
        assert result.first_stall_detected_at == FIXED_FIRST_STALL_TS

    def test_both_stall_fields_coexist(self) -> None:
        result = self._minimal_execution_read(
            is_stalled=True,
            first_stall_detected_at=FIXED_FIRST_STALL_TS,
        )
        dumped = result.model_dump(mode="json")
        assert dumped["is_stalled"] is True
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


class TestExecutionServiceIsStalled:
    """convert_resource propagates is_stalled from column_property via getattr."""

    def _make_resource(self, *, is_stalled: bool = False) -> MagicMock:
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
        resource.first_stall_detected_at = FIXED_FIRST_STALL_TS if is_stalled else None
        resource.is_stalled = is_stalled
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

    def test_is_stalled_false_when_no_stall(self) -> None:
        from syntara.workflows.services.execution_service import ExecutionsConvertResourceMixin

        converter = ExecutionsConvertResourceMixin()
        resource = self._make_resource(is_stalled=False)

        result = converter.convert_resource(resource)

        assert result.is_stalled is False

    def test_is_stalled_true_propagated(self) -> None:
        from syntara.workflows.services.execution_service import ExecutionsConvertResourceMixin

        converter = ExecutionsConvertResourceMixin()
        resource = self._make_resource(is_stalled=True)

        result = converter.convert_resource(resource)

        assert result.is_stalled is True

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


class TestIsStalledColumnProperty:
    """Database-backed tests for the is_stalled correlated EXISTS aggregate.

    Requires a PostgreSQL testcontainer (Docker/Podman). Tests are skipped if
    the test_db_session fixture is unavailable.
    """

    async def _create_execution(
        self,
        session: AsyncSession,
        user: User,
        *,
        status: ExecutionStatus = ExecutionStatus.RUNNING,
    ) -> Execution:
        from syntara.authz.models import Project
        from syntara.workflows.models.workflow import Workflow
        from syntara.workflows.models.workflow_version import WorkflowVersion

        project = Project(name=f"test-project-{uuid4().hex[:8]}", created_by=user.id)
        session.add(project)
        await session.flush()

        wf = Workflow(
            name=f"test-wf-{uuid4().hex[:8]}",
            project_id=project.id,
            created_by=user.id,
        )
        session.add(wf)
        await session.flush()

        wv = WorkflowVersion(
            workflow_id=wf.id,
            version=1,
            schema_version="2.0.0",
            workflow_definition={"activities": [], "edges": [], "triggers": []},
            created_by=user.id,
        )
        session.add(wv)
        await session.flush()

        execution = Execution(
            workflow_id=wf.id,
            workflow_version_id=wv.id,
            project_id=project.id,
            temporal_workflow_id=f"temporal-{uuid4().hex[:8]}",
            status=status,
            created_by=user.id,
            input_data={},
        )
        session.add(execution)
        await session.flush()
        return execution

    @pytest.mark.asyncio
    async def test_is_stalled_false_without_activities(self, test_db_session: AsyncSession, test_user: User) -> None:
        """Execution with no activities has is_stalled=False."""
        from sqlmodel import select

        execution = await self._create_execution(test_db_session, test_user)

        stmt = select(Execution).where(Execution.id == execution.id)
        result = (await test_db_session.execute(stmt)).scalars().one()
        assert result.is_stalled is False

    @pytest.mark.asyncio
    async def test_is_stalled_true_with_stalled_activity(self, test_db_session: AsyncSession, test_user: User) -> None:
        """Execution with a stalled activity has is_stalled=True."""
        from sqlmodel import select

        from syntara.workflows.models.activity_execution import ActivityExecution, ActivityStatus
        from syntara.workflows.workflow_engine.models.workflow_definition import NodeType

        execution = await self._create_execution(test_db_session, test_user)

        activity = ActivityExecution(
            execution_id=execution.id,
            activity_name="step-1",
            temporal_activity_id=f"temporal-act-{uuid4().hex[:8]}",
            node_type=NodeType.SCRIPT,
            status=ActivityStatus.RUNNING,
            started_at=FIXED_STARTED_AT,
            stall_alert_at=FIXED_STALL_TS,
            created_by=test_user.id,
        )
        test_db_session.add(activity)
        await test_db_session.flush()

        stmt = select(Execution).where(Execution.id == execution.id)
        result = (await test_db_session.execute(stmt)).scalars().one()
        assert result.is_stalled is True

    @pytest.mark.asyncio
    async def test_is_stalled_true_with_terminal_stalled_activity(
        self, test_db_session: AsyncSession, test_user: User
    ) -> None:
        """Terminal activity with retained stall marker still makes is_stalled=True."""
        from sqlmodel import select

        from syntara.workflows.models.activity_execution import ActivityExecution, ActivityStatus
        from syntara.workflows.workflow_engine.models.workflow_definition import NodeType

        execution = await self._create_execution(test_db_session, test_user, status=ExecutionStatus.COMPLETED)

        activity = ActivityExecution(
            execution_id=execution.id,
            activity_name="step-1",
            temporal_activity_id=f"temporal-act-{uuid4().hex[:8]}",
            node_type=NodeType.SCRIPT,
            status=ActivityStatus.COMPLETED,
            started_at=FIXED_STARTED_AT,
            completed_at=datetime(2026, 10, 7, 12, 5, 0, tzinfo=UTC),
            stall_alert_at=FIXED_STALL_TS,
            created_by=test_user.id,
        )
        test_db_session.add(activity)
        await test_db_session.flush()

        stmt = select(Execution).where(Execution.id == execution.id)
        result = (await test_db_session.execute(stmt)).scalars().one()
        assert result.is_stalled is True

    @pytest.mark.asyncio
    async def test_is_stalled_false_with_unstalled_activity(
        self, test_db_session: AsyncSession, test_user: User
    ) -> None:
        """Activity without stall marker keeps is_stalled=False."""
        from sqlmodel import select

        from syntara.workflows.models.activity_execution import ActivityExecution, ActivityStatus
        from syntara.workflows.workflow_engine.models.workflow_definition import NodeType

        execution = await self._create_execution(test_db_session, test_user)

        activity = ActivityExecution(
            execution_id=execution.id,
            activity_name="step-1",
            temporal_activity_id=f"temporal-act-{uuid4().hex[:8]}",
            node_type=NodeType.SCRIPT,
            status=ActivityStatus.RUNNING,
            started_at=FIXED_STARTED_AT,
            stall_alert_at=None,
            created_by=test_user.id,
        )
        test_db_session.add(activity)
        await test_db_session.flush()

        stmt = select(Execution).where(Execution.id == execution.id)
        result = (await test_db_session.execute(stmt)).scalars().one()
        assert result.is_stalled is False
