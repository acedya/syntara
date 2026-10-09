"""Tests for SubWorkflowExecutorParameters model."""

import uuid

import pytest
from pydantic import ValidationError

from syntara.workflows.workflow_engine.models.workflow_definition import SubWorkflowExecutorParameters


class TestSubWorkflowExecutorParametersValidation:
    """Test validation of SubWorkflowExecutorParameters fields."""

    def test_valid_minimal_parameters(self) -> None:
        """Test creation with minimal valid parameters."""
        workflow_id = str(uuid.uuid4())
        trigger_id = str(uuid.uuid4())

        params = SubWorkflowExecutorParameters(
            workflow_id=workflow_id,
            trigger_id=trigger_id,
        )

        assert params.workflow_id == workflow_id
        assert params.trigger_id == trigger_id
        assert params.input_mapping == {}

    def test_valid_with_input_mapping(self) -> None:
        """Test creation with input_mapping."""
        workflow_id = str(uuid.uuid4())
        trigger_id = str(uuid.uuid4())

        params = SubWorkflowExecutorParameters(
            workflow_id=workflow_id,
            trigger_id=trigger_id,
            input_mapping={"key1": "value1", "key2": 42},
        )

        assert params.workflow_id == workflow_id
        assert params.trigger_id == trigger_id
        assert params.input_mapping == {"key1": "value1", "key2": 42}

    def test_workflow_id_template_expression(self) -> None:
        """Test workflow_id accepts template expressions."""
        params = SubWorkflowExecutorParameters(
            workflow_id="${parent_step.workflow_id}",
            trigger_id=str(uuid.uuid4()),
        )

        assert params.workflow_id == "${parent_step.workflow_id}"

    def test_trigger_id_template_expression(self) -> None:
        """Test trigger_id accepts template expressions."""
        params = SubWorkflowExecutorParameters(
            workflow_id=str(uuid.uuid4()),
            trigger_id="${parent_step.trigger_id}",
        )

        assert params.trigger_id == "${parent_step.trigger_id}"

    def test_both_fields_template_expressions(self) -> None:
        """Test both workflow_id and trigger_id can be template expressions."""
        params = SubWorkflowExecutorParameters(
            workflow_id="${parent.workflow_id}",
            trigger_id="${parent.trigger_id}",
        )

        assert params.workflow_id == "${parent.workflow_id}"
        assert params.trigger_id == "${parent.trigger_id}"

    def test_invalid_workflow_id_format(self) -> None:
        """Test validation fails for invalid workflow_id format."""
        with pytest.raises(ValidationError) as exc_info:
            SubWorkflowExecutorParameters(
                workflow_id="not-a-uuid",
                trigger_id=str(uuid.uuid4()),
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("workflow_id",)
        assert "Invalid UUID format" in errors[0]["msg"]

    def test_invalid_trigger_id_format(self) -> None:
        """Test validation fails for invalid trigger_id format."""
        with pytest.raises(ValidationError) as exc_info:
            SubWorkflowExecutorParameters(
                workflow_id=str(uuid.uuid4()),
                trigger_id="not-a-uuid",
            )

        errors = exc_info.value.errors()
        assert len(errors) == 1
        assert errors[0]["loc"] == ("trigger_id",)
        assert "Invalid UUID format" in errors[0]["msg"]

    def test_missing_workflow_id(self) -> None:
        """Test validation fails when workflow_id is missing."""
        with pytest.raises(ValidationError) as exc_info:
            SubWorkflowExecutorParameters(  # type: ignore[call-arg]
                trigger_id=str(uuid.uuid4()),
            )

        errors = exc_info.value.errors()
        assert any(e["loc"] == ("workflow_id",) for e in errors)

    def test_missing_trigger_id(self) -> None:
        """Test validation fails when trigger_id is missing."""
        with pytest.raises(ValidationError) as exc_info:
            SubWorkflowExecutorParameters(  # type: ignore[call-arg]
                workflow_id=str(uuid.uuid4()),
            )

        errors = exc_info.value.errors()
        assert any(e["loc"] == ("trigger_id",) for e in errors)


class TestSubWorkflowExecutorParametersInputMapping:
    """Test input_mapping field behavior."""

    def test_input_mapping_defaults_to_empty_dict(self) -> None:
        """Test input_mapping defaults to empty dict when not provided."""
        params = SubWorkflowExecutorParameters(
            workflow_id=str(uuid.uuid4()),
            trigger_id=str(uuid.uuid4()),
        )

        assert params.input_mapping == {}

    def test_input_mapping_static_string_values(self) -> None:
        """Test input_mapping with static string values."""
        params = SubWorkflowExecutorParameters(
            workflow_id=str(uuid.uuid4()),
            trigger_id=str(uuid.uuid4()),
            input_mapping={"name": "test", "env": "production"},
        )

        assert params.input_mapping["name"] == "test"
        assert params.input_mapping["env"] == "production"

    def test_input_mapping_static_numeric_values(self) -> None:
        """Test input_mapping with static numeric values."""
        params = SubWorkflowExecutorParameters(
            workflow_id=str(uuid.uuid4()),
            trigger_id=str(uuid.uuid4()),
            input_mapping={"count": 42, "ratio": 3.14},
        )

        assert params.input_mapping["count"] == 42
        assert params.input_mapping["ratio"] == 3.14

    def test_input_mapping_static_bool_values(self) -> None:
        """Test input_mapping with static boolean values."""
        params = SubWorkflowExecutorParameters(
            workflow_id=str(uuid.uuid4()),
            trigger_id=str(uuid.uuid4()),
            input_mapping={"enabled": True, "disabled": False},
        )

        assert params.input_mapping["enabled"] is True
        assert params.input_mapping["disabled"] is False

    def test_input_mapping_static_dict_values(self) -> None:
        """Test input_mapping with static dict values."""
        params = SubWorkflowExecutorParameters(
            workflow_id=str(uuid.uuid4()),
            trigger_id=str(uuid.uuid4()),
            input_mapping={"config": {"host": "localhost", "port": 8080}},
        )

        assert params.input_mapping["config"] == {"host": "localhost", "port": 8080}

    def test_input_mapping_static_list_values(self) -> None:
        """Test input_mapping with static list values."""
        params = SubWorkflowExecutorParameters(
            workflow_id=str(uuid.uuid4()),
            trigger_id=str(uuid.uuid4()),
            input_mapping={"items": ["a", "b", "c"]},
        )

        assert params.input_mapping["items"] == ["a", "b", "c"]

    def test_input_mapping_template_expression_values(self) -> None:
        """Test input_mapping with template expression values."""
        params = SubWorkflowExecutorParameters(
            workflow_id=str(uuid.uuid4()),
            trigger_id=str(uuid.uuid4()),
            input_mapping={
                "user_id": "${step_1.output.user_id}",
                "status": "${step_2.result.status}",
            },
        )

        assert params.input_mapping["user_id"] == "${step_1.output.user_id}"
        assert params.input_mapping["status"] == "${step_2.result.status}"

    def test_input_mapping_mixed_static_and_template_values(self) -> None:
        """Test input_mapping with mix of static and template expression values."""
        params = SubWorkflowExecutorParameters(
            workflow_id=str(uuid.uuid4()),
            trigger_id=str(uuid.uuid4()),
            input_mapping={
                "static_field": "constant_value",
                "dynamic_field": "${previous_step.output}",
                "count": 42,
                "enabled": True,
            },
        )

        assert params.input_mapping["static_field"] == "constant_value"
        assert params.input_mapping["dynamic_field"] == "${previous_step.output}"
        assert params.input_mapping["count"] == 42
        assert params.input_mapping["enabled"] is True


class TestSubWorkflowExecutorParametersSerialization:
    """Test serialization and deserialization of SubWorkflowExecutorParameters."""

    def test_model_dump(self) -> None:
        """Test serialization via model_dump()."""
        workflow_id = str(uuid.uuid4())
        trigger_id = str(uuid.uuid4())

        params = SubWorkflowExecutorParameters(
            workflow_id=workflow_id,
            trigger_id=trigger_id,
            input_mapping={"key": "value"},
        )

        dumped = params.model_dump()

        assert dumped["workflow_id"] == workflow_id
        assert dumped["trigger_id"] == trigger_id
        assert dumped["input_mapping"] == {"key": "value"}

    def test_model_dump_json(self) -> None:
        """Test JSON serialization via model_dump_json()."""
        import json

        workflow_id = str(uuid.uuid4())
        trigger_id = str(uuid.uuid4())

        params = SubWorkflowExecutorParameters(
            workflow_id=workflow_id,
            trigger_id=trigger_id,
            input_mapping={"count": 42},
        )

        json_str = params.model_dump_json()
        parsed = json.loads(json_str)

        assert parsed["workflow_id"] == workflow_id
        assert parsed["trigger_id"] == trigger_id
        assert parsed["input_mapping"] == {"count": 42}

    def test_deserialization_from_dict(self) -> None:
        """Test deserialization from dict."""
        workflow_id = str(uuid.uuid4())
        trigger_id = str(uuid.uuid4())

        data = {
            "workflow_id": workflow_id,
            "trigger_id": trigger_id,
            "input_mapping": {"key": "value"},
        }

        params = SubWorkflowExecutorParameters(**data)

        assert params.workflow_id == workflow_id
        assert params.trigger_id == trigger_id
        assert params.input_mapping == {"key": "value"}

    def test_round_trip_serialization(self) -> None:
        """Test round-trip serialization preserves data."""
        workflow_id = str(uuid.uuid4())
        trigger_id = str(uuid.uuid4())

        original = SubWorkflowExecutorParameters(
            workflow_id=workflow_id,
            trigger_id=trigger_id,
            input_mapping={
                "string": "value",
                "number": 42,
                "bool": True,
                "dict": {"nested": "value"},
                "list": [1, 2, 3],
                "template": "${step.output}",
            },
        )

        # Serialize and deserialize
        dumped = original.model_dump()
        restored = SubWorkflowExecutorParameters(**dumped)

        assert restored.workflow_id == original.workflow_id
        assert restored.trigger_id == original.trigger_id
        assert restored.input_mapping == original.input_mapping
