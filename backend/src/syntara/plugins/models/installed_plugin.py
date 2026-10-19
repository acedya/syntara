"""Installed plugin SQLModel definitions.

An installed plugin records the immutable identity of a plugin release that
passed the artifact validation pipeline, together with the descriptor,
documentation, and validation report captured at install time.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any, ClassVar
from uuid import UUID

from sqlalchemy import Index, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import DateTime, Field

from syntara.core.models.base.named import NamedResource
from syntara.core.models.base.query_params import BaseListParams
from syntara.core.models.base.user_owned import UserOwnedResource
from syntara.core.models.pagination import ResourcesResponse
from syntara.core.utils.sqlmodel import postgres_enum_column


class PluginInstallStatus(StrEnum):
    """Lifecycle status of an installed plugin."""

    INSTALLED = "installed"
    FAILED = "failed"


class InstalledPlugin(NamedResource, UserOwnedResource, table=True):
    """Installed plugin database model.

    ``name`` holds ``{namespace}/{plugin_name}`` for display; the identity
    columns keep the catalog identity. One version of a plugin can be
    installed at a time (enforced by a unique constraint).
    """

    __tablename__ = "installed_plugins"
    __table_args__ = (
        UniqueConstraint("namespace", "plugin_name", name="uq_installed_plugins_identity"),
        Index("ix_installed_plugins_created_at_id", "created_at", "id"),
    )

    namespace: str = Field(
        min_length=1,
        max_length=255,
        description="Plugin namespace",
        index=True,
    )

    plugin_name: str = Field(
        min_length=1,
        max_length=255,
        description="Plugin name within its namespace",
        index=True,
    )

    version: str = Field(
        min_length=1,
        max_length=64,
        description="Installed plugin version",
        index=True,
    )

    artifact_repository: str = Field(
        min_length=1,
        max_length=255,
        description="OCI repository the artifact was pulled from",
    )

    artifact_digest: str = Field(
        min_length=1,
        max_length=255,
        description="Immutable digest of the installed artifact manifest",
        index=True,
    )

    catalog_source_id: UUID | None = Field(
        default=None,
        foreign_key="plugin_catalog_sources.id",
        ondelete="SET NULL",
        description="Catalog source the plugin was installed from",
    )

    display_name: str | None = Field(
        default=None,
        max_length=255,
        description="Display name captured from the plugin descriptor at install time",
    )

    status: PluginInstallStatus = Field(
        default=PluginInstallStatus.INSTALLED,
        sa_column=postgres_enum_column(
            PluginInstallStatus,
            "plugin_install_status",
            server_default=text("'installed'"),
        ),
        description="Installation status",
    )

    descriptor: dict[str, Any] = Field(
        default_factory=dict,
        sa_type=JSONB(),  # type: ignore[call-overload]
        description="Full plugin descriptor captured at install time",
    )

    documentation: str | None = Field(
        default=None,
        sa_type=Text(),  # type: ignore[call-overload]
        description="Plugin documentation markdown captured at install time",
    )

    actions: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_type=JSONB(),  # type: ignore[call-overload]
        description="Action summaries from the installed descriptor",
    )

    triggers: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_type=JSONB(),  # type: ignore[call-overload]
        description="Trigger summaries from the installed descriptor",
    )

    validation_report: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_type=JSONB(),  # type: ignore[call-overload]
        description="Artifact validation checks recorded during installation",
    )

    installed_at: datetime | None = Field(
        default=None,
        description="Timestamp of installation",
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )

    __filterable_fields__: ClassVar[list[str]] = [
        *NamedResource.__filterable_fields__,
        *UserOwnedResource.__filterable_fields__,
        "namespace",
        "plugin_name",
        "version",
        "status",
        "artifact_digest",
    ]

    __sortable_fields__: ClassVar[list[str]] = [
        *NamedResource.__sortable_fields__,
        *UserOwnedResource.__sortable_fields__,
        "version",
        "installed_at",
    ]

    FIELD_SCHEMA_EXTRAS: ClassVar[dict[str, dict[str, object]]] = {
        **NamedResource.FIELD_SCHEMA_EXTRAS,
        **UserOwnedResource.FIELD_SCHEMA_EXTRAS,
        "namespace": {"example": "example"},
        "plugin_name": {"example": "hello-world"},
        "version": {"example": "0.1.0"},
        "artifact_repository": {"example": "example/plugins/hello-world"},
        "artifact_digest": {"example": "sha256:c6cb2f7c8466799f9ae1874651321bcf19459980650aa7b4342fc7145cb0cec"},
    }


class InstalledPluginRead(NamedResource, UserOwnedResource):
    """Installed plugin response schema (list-safe; no descriptor payload)."""

    namespace: str = Field(description="Plugin namespace")
    plugin_name: str = Field(description="Plugin name within its namespace")
    version: str = Field(description="Installed plugin version")
    display_name: str | None = Field(default=None, description="Display name from the descriptor")
    artifact_repository: str = Field(description="OCI repository the artifact was pulled from")
    artifact_digest: str = Field(description="Immutable artifact digest")
    catalog_source_id: UUID | None = Field(default=None, description="Catalog source the plugin was installed from")
    status: PluginInstallStatus = Field(description="Installation status")
    actions: list[dict[str, Any]] = Field(default_factory=list, description="Action summaries from the descriptor")
    triggers: list[dict[str, Any]] = Field(default_factory=list, description="Trigger summaries from the descriptor")
    installed_at: datetime | None = Field(default=None, description="Installation timestamp")


class InstalledPluginDetail(InstalledPluginRead):
    """Installed plugin detail response including descriptor and docs."""

    descriptor: dict[str, Any] = Field(
        default_factory=dict, description="Full plugin descriptor captured at install time"
    )
    documentation: str | None = Field(default=None, description="Plugin documentation markdown")
    validation_report: list[dict[str, Any]] = Field(
        default_factory=list, description="Artifact validation checks recorded at install time"
    )


class InstalledPluginCreate(NamedResource):
    """Installed plugin creation schema (used internally by the install flow)."""

    namespace: str = Field(description="Plugin namespace")
    plugin_name: str = Field(description="Plugin name within its namespace")
    version: str = Field(description="Plugin version")


class InstalledPluginListParams(BaseListParams):
    """Query parameters for listing installed plugins."""


class InstalledPluginListResponse(ResourcesResponse[InstalledPluginRead]):
    """Paginated installed plugin list response."""
