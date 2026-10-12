"""Unit test for AAP-87786: GET /invocations/{id} leaks raw credential_id.

``InvocationMetadata.credential_id`` is modelled as ``SecretStr`` specifically
so it is "excluded from audit logs and masked in repr"
(see ``agent_orchestrator/models/context_data.py``), and the credentials API
itself masks secret values in its read schema (``CredentialRead``). But
``Invocation.context_data`` is stored and returned as a raw, untyped
``dict[str, object]`` JSONB blob with no redaction step, so a credential_id
placed in ``context_data.metadata`` by an invocation is echoed back verbatim
by ``GET /api/v1/invocations/{id}``. Any caller with ``invocation:read``
can therefore harvest a project's LLM credential_id from someone else's
invocation and reuse it directly, exactly as described in AAP-87786's
steps to reproduce.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from syntara.agent_orchestrator.models.invocation import Invocation, InvocationStatus
from syntara.auth import get_current_user
from syntara.invocations import router as invocations_router_module
from syntara.invocations.router import get_invocation_service, router

PROJECT_ID = uuid4()
INVOCATION_ID = uuid4()
USER_ID = uuid4()
HARVESTABLE_CREDENTIAL_ID = str(uuid4())


def _make_invocation_with_credential_metadata() -> Invocation:
    return Invocation(
        id=INVOCATION_ID,
        prompt="Deploy app to production",
        session_id="session-001",
        project_id=PROJECT_ID,
        created_by=USER_ID,
        status=InvocationStatus.COMPLETED,
        created_at=datetime.now(tz=UTC),
        updated_at=datetime.now(tz=UTC),
        context_data={
            "metadata": {
                "credential_id": HARVESTABLE_CREDENTIAL_ID,
                "llm_model_id": "llm-model-123",
            }
        },
    )


@pytest.fixture
def mock_invocation_service() -> AsyncMock:
    service = AsyncMock()
    service.get_invocation.return_value = _make_invocation_with_credential_metadata()
    return service


@pytest.fixture
def app(mock_invocation_service: AsyncMock) -> FastAPI:
    test_app = FastAPI()

    async def _no_auth() -> None:
        return None

    test_app.dependency_overrides[get_current_user] = lambda: MagicMock(id=USER_ID)
    test_app.dependency_overrides[get_invocation_service] = lambda: mock_invocation_service
    test_app.dependency_overrides[invocations_router_module._invocation_perm_read] = _no_auth

    test_app.include_router(router, prefix="/api/v1")
    return test_app


@pytest.fixture
def client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


class TestInvocationResponseDoesNotExposeCredentialId:
    """GET /invocations/{id} must not return the raw LLM credential_id."""

    @pytest.mark.asyncio
    async def test_get_invocation_redacts_credential_id_from_context_data(
        self, client: AsyncClient, mock_invocation_service: AsyncMock
    ) -> None:
        async with client:
            resp = await client.get(f"/api/v1/invocations/{INVOCATION_ID}")

        assert resp.status_code == 200
        body_text = resp.text

        assert HARVESTABLE_CREDENTIAL_ID not in body_text, (
            "GET /invocations/{id} must not expose the raw credential_id from "
            "context_data.metadata; it should be redacted like CredentialRead "
            "masks secret inputs."
        )
