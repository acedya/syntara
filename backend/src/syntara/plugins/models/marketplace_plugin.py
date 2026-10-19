"""Marketplace plugin SQLModel definitions.

Marketplace plugins are catalog entries materialized during a catalog-source
sync. Each row is enriched with display metadata read from the plugin's OCI
artifact (descriptor and content bundle), so the marketplace UI can render
cards and detail views without contacting the registry again.
"""

from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID

from sqlalchemy import Index, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import DateTime, Field

from syntara.core.models.base.base_resource import BaseResource
from syntara.core.models.base.query_params import BaseListParams
from syntara.core.models.pagination import ResourcesResponse


class MarketplacePlugin(BaseResource, table=True):
    """Marketplace plugin database model.

    One row per catalog entry (source, namespace, name, version). Refreshed
    wholesale on every catalog sync of the owning source.
    """

    __tablename__ = "marketplace_plugins"
    __table_args__ = (
        UniqueConstraint(
            "catalog_source_id",
            "namespace",
            "plugin_name",
            "version",
            name="uq_marketplace_plugins_source_identity",
        ),
        Index("ix_marketplace_plugins_created_at_id", "created_at", "id"),
        Index("ix_marketplace_plugins_labels", "labels", postgresql_using="gin"),
    )

    catalog_source_id: UUID = Field(
        foreign_key="plugin_catalog_sources.id",
        ondelete="CASCADE",
        description="Catalog source this entry was synced from",
        index=True,
    )

    namespace: str = Field(
        min_length=1,
        max_length=255,
        description="Plugin namespace, e.g. example",
        index=True,
    )

    plugin_name: str = Field(
        min_length=1,
        max_length=255,
        description="Plugin name within its namespace, e.g. hello-world",
        index=True,
    )

    version: str = Field(
        min_length=1,
        max_length=64,
        description="Plugin version from the catalog entry",
        index=True,
    )

    display_name: str | None = Field(
        default=None,
        max_length=255,
        description="Display name from the plugin descriptor",
    )

    description: str | None = Field(
        default=None,
        sa_type=Text(),  # type: ignore[call-overload]
        description="Description from the plugin descriptor",
    )

    artifact_repository: str = Field(
        min_length=1,
        max_length=255,
        description="OCI repository holding the plugin artifact",
    )

    artifact_digest: str = Field(
        min_length=1,
        max_length=255,
        description="Immutable digest of the plugin artifact manifest",
    )

    documentation_digest: str | None = Field(
        default=None,
        max_length=255,
        description="Digest of the plugin documentation asset",
    )

    runtime_ownerships: list[str] = Field(
        default_factory=list,
        sa_type=JSONB(),  # type: ignore[call-overload]
        description="Runtime ownership declared by the plugin (platform-runner, custom-workload)",
    )

    is_deprecated: bool = Field(default=False, description="Whether the release is deprecated")
    is_withdrawn: bool = Field(default=False, description="Whether the release was withdrawn")

    actions: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_type=JSONB(),  # type: ignore[call-overload]
        description="Action summaries extracted from the plugin descriptor",
    )

    triggers: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_type=JSONB(),  # type: ignore[call-overload]
        description="Trigger summaries extracted from the plugin descriptor",
    )

    documentation: str | None = Field(
        default=None,
        sa_type=Text(),  # type: ignore[call-overload]
        description="Plugin documentation markdown read from the content bundle",
    )

    catalog_generation: int | None = Field(
        default=None,
        description="Catalog index generation this entry was observed in",
    )

    synced_at: datetime | None = Field(
        default=None,
        description="Timestamp of the sync that produced this row",
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )

    __filterable_fields__: ClassVar[list[str]] = [
        *BaseResource.__filterable_fields__,
        "namespace",
        "plugin_name",
        "version",
        "display_name",
        "catalog_source_id",
        "is_deprecated",
    ]

    __sortable_fields__: ClassVar[list[str]] = [
        *BaseResource.__sortable_fields__,
        "namespace",
        "plugin_name",
        "version",
        "display_name",
    ]


class MarketplacePluginRead(BaseResource):
    """Marketplace plugin response schema."""

    catalog_source_id: UUID = Field(description="Catalog source this entry was synced from")
    namespace: str = Field(description="Plugin namespace")
    plugin_name: str = Field(description="Plugin name within its namespace")
    version: str = Field(description="Plugin version")
    display_name: str | None = Field(default=None, description="Display name from the descriptor")
    description: str | None = Field(default=None, description="Description from the descriptor")
    artifact_repository: str = Field(description="OCI repository holding the plugin artifact")
    artifact_digest: str = Field(description="Immutable plugin artifact digest")
    documentation_digest: str | None = Field(default=None, description="Documentation asset digest")
    runtime_ownerships: list[str] = Field(default_factory=list, description="Runtime ownership declarations")
    is_deprecated: bool = Field(default=False, description="Whether the release is deprecated")
    is_withdrawn: bool = Field(default=False, description="Whether the release was withdrawn")
    actions: list[dict[str, Any]] = Field(default_factory=list, description="Action summaries from the descriptor")
    triggers: list[dict[str, Any]] = Field(default_factory=list, description="Trigger summaries from the descriptor")
    documentation: str | None = Field(
        default=None, description="Plugin documentation markdown (present on detail reads)"
    )
    catalog_generation: int | None = Field(
        default=None, description="Catalog generation of the sync that produced this row"
    )
    synced_at: datetime | None = Field(default=None, description="Timestamp of the sync that produced this row")


class MarketplacePluginListParams(BaseListParams):
    """Query parameters for listing marketplace plugins."""


class MarketplacePluginListResponse(ResourcesResponse[MarketplacePluginRead]):
    """Paginated marketplace plugin list response."""
