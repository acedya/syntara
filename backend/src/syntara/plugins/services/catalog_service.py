"""Plugin catalog synchronization and marketplace queries.

Syncing a catalog source reads the catalog-index artifact from its registry
channel, verifies the artifact envelope, and materializes one marketplace
row per catalog entry. For each entry the plugin artifact is also pulled and
verified so the marketplace UI can show descriptor metadata, action
summaries, and documentation without contacting the registry again.
"""

from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlmodel import col, delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from syntara.core.models.user import User
from syntara.core.services.base import BaseService
from syntara.plugins.exceptions import (
    PluginNameConflictError,
    PluginNotFoundError,
    PluginRegistryValidationError,
)
from syntara.plugins.models.installed_plugin import InstalledPlugin
from syntara.plugins.models.marketplace_plugin import (
    MarketplacePlugin,
    MarketplacePluginListResponse,
)
from syntara.plugins.models.plugin_catalog_source import (
    CatalogSourceSyncStatus,
    PluginCatalogSource,
    PluginCatalogSourceListResponse,
)
from syntara.plugins.services.artifacts import (
    CATALOG_CONFIG_MEDIA_TYPE,
    CATALOG_CONTENT_MEDIA_TYPE,
    CATALOG_INDEX_ARTIFACT_TYPE,
    PLUGIN_ARTIFACT_TYPE,
    documentation_path,
    extract_file,
    parse_json,
    read_plugin_artifact,
    summarize_targets,
)
from syntara.plugins.services.oci_client import (
    OciRegistryClient,
    descriptor_digest,
    descriptor_media_type,
    find_layer_by_media_type,
)

logger = structlog.stdlib.get_logger(__name__)


class PluginCatalogService(BaseService):
    """Service for catalog sources and marketplace plugin queries."""

    def __init__(self, session: AsyncSession, user: User) -> None:
        """Create the service with a database session and requesting user."""
        super().__init__(session, user)

    # ------------------------------------------------------------------
    # Catalog sources
    # ------------------------------------------------------------------

    async def create_catalog_source(self, source_data: dict[str, Any]) -> PluginCatalogSource:
        """Create one catalog source; names must be unique."""
        existing = (
            await self.session.exec(
                select(PluginCatalogSource).where(col(PluginCatalogSource.name) == source_data["name"])
            )
        ).first()
        if existing is not None:
            raise PluginNameConflictError(source_data["name"])
        source = PluginCatalogSource(**source_data, created_by=self.user.id, updated_by=self.user.id)
        self.session.add(source)
        await self.session.commit()
        await self.session.refresh(source)
        return source

    async def get_catalog_source(self, source_id: UUID) -> PluginCatalogSource:
        """Return one catalog source by ID."""
        source = await self.session.get(PluginCatalogSource, source_id)
        if source is None:
            msg = "Catalog source"
            raise PluginNotFoundError(msg, source_id)
        return source

    async def delete_catalog_source(self, source_id: UUID) -> None:
        """Delete one catalog source and its materialized marketplace rows."""
        source = await self.get_catalog_source(source_id)
        await self.session.exec(delete(MarketplacePlugin).where(col(MarketplacePlugin.catalog_source_id) == source_id))
        await self.session.delete(source)
        await self.session.commit()

    async def list_catalog_sources(
        self,
        *,
        limit: int,
        cursor: str | None,
        sort: str | None,
        query_params_items: Iterable[tuple[str, str]],
        include_total: bool,
    ) -> PluginCatalogSourceListResponse:
        """List catalog sources with the shared filtering/sorting pipeline."""
        return await self.list_resources(
            model=PluginCatalogSource,
            response_type=PluginCatalogSourceListResponse,
            limit=limit,
            cursor=cursor,
            sort=sort,
            query_params_items=query_params_items,
            include_total=include_total,
        )

    # ------------------------------------------------------------------
    # Marketplace plugins
    # ------------------------------------------------------------------

    async def list_marketplace_plugins(
        self,
        *,
        limit: int,
        cursor: str | None,
        sort: str | None,
        query_params_items: Iterable[tuple[str, str]],
        include_total: bool,
    ) -> MarketplacePluginListResponse:
        """List marketplace plugins with the shared filtering/sorting pipeline."""
        return await self.list_resources(
            model=MarketplacePlugin,
            response_type=MarketplacePluginListResponse,
            limit=limit,
            cursor=cursor,
            sort=sort,
            query_params_items=query_params_items,
            include_total=include_total,
        )

    async def get_marketplace_plugin(self, plugin_id: UUID) -> MarketplacePlugin:
        """Return one marketplace plugin by ID."""
        plugin = await self.session.get(MarketplacePlugin, plugin_id)
        if plugin is None:
            msg = "Marketplace plugin"
            raise PluginNotFoundError(msg, plugin_id)
        return plugin

    async def installed_identities(self) -> set[tuple[str, str, str]]:
        """Return (namespace, name, version) identities already installed."""
        rows = await self.session.exec(
            select(
                InstalledPlugin.namespace,
                InstalledPlugin.plugin_name,
                InstalledPlugin.version,
            )
        )
        return {(row[0], row[1], row[2]) for row in rows.all()}

    # ------------------------------------------------------------------
    # Synchronization
    # ------------------------------------------------------------------

    async def sync_catalog_source(self, source_id: UUID) -> PluginCatalogSource:
        """Synchronize one catalog source from its registry channel.

        The catalog index is fetched by channel tag, its artifact envelope is
        verified, and each entry is materialized (or refreshed) as a
        marketplace row enriched from the plugin artifact itself. Failures
        are recorded on the source row and re-raised for the API layer.
        """
        source = await self.get_catalog_source(source_id)
        source.sync_status = CatalogSourceSyncStatus.SYNCING
        source.sync_error = None
        await self.session.commit()

        try:
            entries, generation = await self._read_catalog_index(source)
            materialized: list[MarketplacePlugin] = []
            for entry in entries:
                row = await self._materialize_entry(source, entry, generation)
                if row is not None:
                    materialized.append(row)
            # The catalog index is the source of truth per source: drop rows
            # that no longer appear in the index.
            keep_ids = [row.id for row in materialized]
            statement = delete(MarketplacePlugin).where(
                col(MarketplacePlugin.catalog_source_id) == source.id,
                col(MarketplacePlugin.id).not_in(keep_ids),
            )
            await self.session.exec(statement)
            source.sync_status = CatalogSourceSyncStatus.SYNCED
            source.sync_error = None
            source.last_synced_at = datetime.now(UTC)
            source.catalog_generation = generation
            await self.session.commit()
            await self.session.refresh(source)
            logger.info(
                "plugin catalog synced",
                source=source.name,
                entries=len(materialized),
                generation=generation,
            )
        except Exception as error:
            source.sync_status = CatalogSourceSyncStatus.ERROR
            source.sync_error = str(getattr(error, "message", error))
            source.last_synced_at = datetime.now(UTC)
            await self.session.commit()
            await self.session.refresh(source)
            raise
        return source

    async def _read_catalog_index(self, source: PluginCatalogSource) -> tuple[list[dict[str, Any]], int]:
        """Fetch and verify the catalog-index artifact for one source."""
        client = OciRegistryClient(source.registry_origin, username=source.username, password=source.password)
        manifest, _digest, _content = await client.get_manifest(source.repository, source.channel)
        if manifest.get("artifactType") != CATALOG_INDEX_ARTIFACT_TYPE:
            msg = (
                f"{source.repository}:{source.channel} is not a Syntara catalog index "
                f"(artifactType {manifest.get('artifactType')!r})"
            )
            raise PluginRegistryValidationError(msg)
        config_descriptor = manifest.get("config")
        if not isinstance(config_descriptor, dict):
            msg = "catalog manifest is missing its config"
            raise PluginRegistryValidationError(msg)
        if descriptor_media_type(config_descriptor) != CATALOG_CONFIG_MEDIA_TYPE:
            msg = "catalog manifest config has an unexpected media type"
            raise PluginRegistryValidationError(msg)
        await client.get_blob(source.repository, descriptor_digest(config_descriptor))

        content_layer = find_layer_by_media_type(manifest, CATALOG_CONTENT_MEDIA_TYPE)
        if content_layer is None:
            msg = "catalog manifest has no catalog-index.json layer"
            raise PluginRegistryValidationError(msg)
        content = await client.get_blob(source.repository, descriptor_digest(content_layer))
        index = parse_json(content, "catalog index")
        if index.get("kind") != "CatalogIndex":
            msg = "catalog index document is not a CatalogIndex"
            raise PluginRegistryValidationError(msg)
        metadata = index.get("metadata")
        if not isinstance(metadata, dict):
            msg = "catalog index is missing metadata"
            raise PluginRegistryValidationError(msg)
        generation = metadata.get("generation")
        if not isinstance(generation, int) or generation < 1:
            msg = "catalog index has an invalid generation"
            raise PluginRegistryValidationError(msg)
        entries = index.get("spec", {}).get("entries")
        if not isinstance(entries, list):
            msg = "catalog index has no entries"
            raise PluginRegistryValidationError(msg)
        return entries, generation

    async def _materialize_entry(
        self, source: PluginCatalogSource, entry: dict[str, Any], generation: int
    ) -> MarketplacePlugin:
        """Upsert one marketplace row from a catalog entry and its artifact."""
        namespace = entry.get("namespace")
        name = entry.get("name")
        version = entry.get("version")
        repository = entry.get("artifactRepository")
        digest = entry.get("artifactDigest")
        if not (
            isinstance(namespace, str)
            and namespace
            and isinstance(name, str)
            and name
            and isinstance(version, str)
            and version
            and isinstance(repository, str)
            and repository
            and isinstance(digest, str)
            and digest
        ):
            msg = "catalog entry is missing required identity fields"
            raise PluginRegistryValidationError(msg)

        client = OciRegistryClient(source.registry_origin, username=source.username, password=source.password)
        manifest, manifest_digest, _content = await client.get_manifest(repository, digest)
        if manifest.get("artifactType") != PLUGIN_ARTIFACT_TYPE:
            msg = f"{repository}@{digest} is not a Syntara plugin artifact"
            raise PluginRegistryValidationError(msg)
        descriptor, content_bundle = await read_plugin_artifact(client, repository, manifest)
        descriptor_metadata = descriptor.get("metadata")
        if not isinstance(descriptor_metadata, dict):
            msg = "plugin descriptor is missing metadata"
            raise PluginRegistryValidationError(msg)
        actions, triggers = summarize_targets(descriptor)
        documentation: str | None = None
        doc_path = documentation_path(descriptor)
        if doc_path is not None:
            doc_bytes = extract_file(content_bundle, doc_path)
            if doc_bytes is not None:
                documentation = doc_bytes.decode("utf-8")

        existing = (
            await self.session.exec(
                select(MarketplacePlugin).where(
                    col(MarketplacePlugin.catalog_source_id) == source.id,
                    col(MarketplacePlugin.namespace) == namespace,
                    col(MarketplacePlugin.plugin_name) == name,
                    col(MarketplacePlugin.version) == version,
                )
            )
        ).first()

        row = existing or MarketplacePlugin(
            catalog_source_id=source.id,
            namespace=namespace,
            plugin_name=name,
            version=version,
            labels={},
        )
        row.display_name = descriptor_metadata.get("displayName")
        row.description = descriptor_metadata.get("description")
        row.artifact_repository = repository
        row.artifact_digest = manifest_digest
        row.documentation_digest = entry.get("documentationDigest")
        row.runtime_ownerships = entry.get("runtimeOwnerships") or []
        row.is_deprecated = bool(entry.get("deprecated"))
        row.is_withdrawn = bool(entry.get("withdrawn"))
        row.actions = actions
        row.triggers = triggers
        row.documentation = documentation
        row.catalog_generation = generation
        row.synced_at = datetime.now(UTC)
        self.session.add(row)
        await self.session.flush()
        return row
