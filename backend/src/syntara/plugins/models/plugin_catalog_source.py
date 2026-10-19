"""Plugin catalog source SQLModel definitions.

A catalog source describes one OCI registry location holding a Syntara
catalog-index artifact (built with ``syntara-plugin publish`` / ``catalog
update``). Syncing a source reads the index and materializes its entries as
marketplace plugins.
"""

from datetime import datetime
from enum import StrEnum
from typing import ClassVar

from sqlalchemy import Index, Text, UniqueConstraint, text
from sqlmodel import DateTime, Field, String

from syntara.core.constants import FieldLimits
from syntara.core.models.base.named import NamedResource
from syntara.core.models.base.query_params import BaseListParams
from syntara.core.models.base.user_owned import UserOwnedResource
from syntara.core.models.pagination import ResourcesResponse
from syntara.core.utils.sqlmodel import postgres_enum_column

_REGISTRY_ORIGIN_DESCRIPTION = "Registry origin including scheme, e.g. http://localhost:5000"


class CatalogSourceSyncStatus(StrEnum):
    """Status of the last catalog synchronization for a source."""

    NEVER = "never"
    SYNCING = "syncing"
    SYNCED = "synced"
    ERROR = "error"


class PluginCatalogSource(NamedResource, UserOwnedResource, table=True):
    """Catalog source database model.

    Points at one OCI registry catalog index channel. Marketplace plugins are
    materialized from the index during synchronization.
    """

    __tablename__ = "plugin_catalog_sources"
    __table_args__ = (
        UniqueConstraint("name", name="uq_plugin_catalog_sources_name"),
        Index("ix_plugin_catalog_sources_created_at_id", "created_at", "id"),
    )

    registry_origin: str = Field(
        min_length=1,
        max_length=FieldLimits.DESCRIPTION_MAX_LENGTH,
        sa_type=String(FieldLimits.DESCRIPTION_MAX_LENGTH),  # type: ignore[call-overload]
        description=_REGISTRY_ORIGIN_DESCRIPTION,
    )

    repository: str = Field(
        min_length=1,
        max_length=255,
        sa_type=String(255),  # type: ignore[call-overload]
        description="OCI repository holding the catalog-index artifact",
    )

    channel: str = Field(
        min_length=1,
        max_length=255,
        sa_type=String(255),  # type: ignore[call-overload]
        description="Mutable catalog channel tag, e.g. stable",
    )

    username: str | None = Field(
        default=None,
        max_length=255,
        sa_type=String(255),  # type: ignore[call-overload]
        description="Optional registry username (POC: stored in plain text)",
    )

    password: str | None = Field(
        default=None,
        max_length=255,
        sa_type=String(255),  # type: ignore[call-overload]
        description="Optional registry password (POC: stored in plain text)",
    )

    sync_status: CatalogSourceSyncStatus = Field(
        default=CatalogSourceSyncStatus.NEVER,
        sa_column=postgres_enum_column(
            CatalogSourceSyncStatus,
            "catalog_source_sync_status",
            server_default=text("'never'"),
        ),
        description="Status of the last catalog synchronization",
    )

    sync_error: str | None = Field(
        default=None,
        sa_type=Text(),  # type: ignore[call-overload]
        description="Error message from the last failed synchronization",
    )

    last_synced_at: datetime | None = Field(
        default=None,
        description="Timestamp of the last synchronization attempt",
        sa_type=DateTime(timezone=True),  # type: ignore[call-overload]
    )

    catalog_generation: int | None = Field(
        default=None,
        description="Catalog index generation observed by the last successful sync",
    )

    # Background sync writes are not user edits; don't bump updated_at for them.
    __updated_at_exempt_fields__: ClassVar[frozenset[str]] = frozenset(
        {
            "sync_status",
            "sync_error",
            "last_synced_at",
            "catalog_generation",
        }
    )

    __filterable_fields__: ClassVar[list[str]] = [
        *NamedResource.__filterable_fields__,
        *UserOwnedResource.__filterable_fields__,
        "registry_origin",
        "repository",
        "channel",
        "sync_status",
    ]

    __sortable_fields__: ClassVar[list[str]] = [
        *NamedResource.__sortable_fields__,
        *UserOwnedResource.__sortable_fields__,
        "sync_status",
        "last_synced_at",
    ]

    FIELD_SCHEMA_EXTRAS: ClassVar[dict[str, dict[str, object]]] = {
        **NamedResource.FIELD_SCHEMA_EXTRAS,
        **UserOwnedResource.FIELD_SCHEMA_EXTRAS,
        "registry_origin": {"example": "http://localhost:5000"},
        "repository": {"example": "example/catalog-index"},
        "channel": {"example": "stable"},
        "username": {"example": "publisher"},
    }


class PluginCatalogSourceRead(NamedResource, UserOwnedResource):
    """Catalog source response schema (never exposes the password)."""

    registry_origin: str = Field(description=_REGISTRY_ORIGIN_DESCRIPTION)
    repository: str = Field(description="OCI repository holding the catalog-index artifact")
    channel: str = Field(description="Mutable catalog channel tag")
    username: str | None = Field(default=None, description="Registry username, if configured")
    sync_status: CatalogSourceSyncStatus = Field(description="Last synchronization status")
    sync_error: str | None = Field(default=None, description="Last synchronization error")
    last_synced_at: datetime | None = Field(default=None, description="Last sync attempt time")
    catalog_generation: int | None = Field(default=None, description="Catalog generation from the last successful sync")
    has_credentials: bool = Field(default=False, description="Whether a password is configured")


class PluginCatalogSourceCreate(NamedResource):
    """Catalog source creation schema."""

    registry_origin: str = Field(description=_REGISTRY_ORIGIN_DESCRIPTION)
    repository: str = Field(description="OCI repository holding the catalog-index artifact")
    channel: str = Field(default="stable", description="Mutable catalog channel tag")
    username: str | None = Field(default=None, description="Optional registry username")
    password: str | None = Field(default=None, description="Optional registry password")


class PluginCatalogSourceListParams(BaseListParams):
    """Query parameters for listing catalog sources."""


class PluginCatalogSourceListResponse(ResourcesResponse[PluginCatalogSourceRead]):
    """Paginated catalog source list response."""
