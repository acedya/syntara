"""Plugin marketplace and installation API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, File, Query, Request, UploadFile, status
from sqlmodel.ext.asyncio.session import AsyncSession

from syntara.audit.decorators import audit
from syntara.audit.models.audit_event import EventCategory
from syntara.auth import get_current_user
from syntara.authz.dependencies import PermissionChecker
from syntara.core.database.session import get_db
from syntara.core.models import User
from syntara.core.syntara_router import SyntaraRouter
from syntara.plugins.models import (
    InstalledPluginDetail,
    InstalledPluginListParams,
    InstalledPluginListResponse,
    InstalledPluginRead,
    MarketplacePluginListParams,
    MarketplacePluginListResponse,
    MarketplacePluginRead,
    PluginCatalogSourceCreate,
    PluginCatalogSourceListParams,
    PluginCatalogSourceListResponse,
    PluginCatalogSourceRead,
)
from syntara.plugins.services.catalog_service import PluginCatalogService
from syntara.plugins.services.install_service import PluginInstallService

router = SyntaraRouter(prefix="/plugins", tags=["Plugins"])

_perm_source_create = PermissionChecker("plugin", "create")
_perm_source_delete = PermissionChecker("plugin", "delete")
_perm_source_sync = PermissionChecker("plugin", "sync")
_perm_read = PermissionChecker("plugin", "read")
_perm_install = PermissionChecker("plugin", "install")
_perm_uninstall = PermissionChecker("plugin", "uninstall")


def get_catalog_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PluginCatalogService:
    """Dependency provider for PluginCatalogService."""
    return PluginCatalogService(db, current_user)


def get_install_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> PluginInstallService:
    """Dependency provider for PluginInstallService."""
    return PluginInstallService(db, current_user)


def _source_read(source: object) -> PluginCatalogSourceRead:
    """Convert a catalog source row; the password is not part of the Read schema."""
    read = PluginCatalogSourceRead.model_validate(source)
    read.has_credentials = bool(getattr(source, "password", None))
    return read


# ============================================================================
# Catalog sources
# ============================================================================


@router.post(
    "/catalog-sources",
    summary="Create plugin catalog source",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_perm_source_create)],
    operation_id="create_plugin_catalog_source",
    response_description="Catalog source created",
)
@audit(EventCategory.USER_ACTION, event_action="plugin_catalog_source_create", capture_args={"name"})
async def create_plugin_catalog_source(
    body: PluginCatalogSourceCreate,
    service: Annotated[PluginCatalogService, Depends(get_catalog_service)],
) -> PluginCatalogSourceRead:
    """Create a plugin catalog source pointing at an OCI registry catalog index.

    Requires: plugin:create permission.
    """
    source = await service.create_catalog_source(
        {
            "name": body.name,
            "description": body.description,
            "registry_origin": body.registry_origin,
            "repository": body.repository,
            "channel": body.channel,
            "username": body.username,
            "password": body.password,
            "labels": body.labels or {},
        }
    )
    return _source_read(source)


@router.get(
    "/catalog-sources",
    summary="List plugin catalog sources",
    operation_id="list_plugin_catalog_sources",
    response_description="Paginated list of plugin catalog sources",
)
async def list_plugin_catalog_sources(
    request: Request,
    service: Annotated[PluginCatalogService, Depends(get_catalog_service)],
    params: Annotated[PluginCatalogSourceListParams, Query()],
) -> PluginCatalogSourceListResponse:
    """List configured plugin catalog sources."""
    response = await service.list_catalog_sources(
        limit=params.limit,
        cursor=params.cursor,
        sort=params.sort,
        query_params_items=request.query_params.items(),
        include_total=params.include_total,
    )
    response.resources = [_source_read(source) for source in response.resources]
    return response


@router.get(
    "/catalog-sources/{source_id}",
    summary="Get plugin catalog source",
    dependencies=[Depends(_perm_read)],
    operation_id="get_plugin_catalog_source",
    response_description="Catalog source details",
)
async def get_plugin_catalog_source(
    source_id: UUID,
    service: Annotated[PluginCatalogService, Depends(get_catalog_service)],
) -> PluginCatalogSourceRead:
    """Get a plugin catalog source by ID."""
    return _source_read(await service.get_catalog_source(source_id))


@router.delete(
    "/catalog-sources/{source_id}",
    summary="Delete plugin catalog source",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_perm_source_delete)],
    operation_id="delete_plugin_catalog_source",
    response_description="Catalog source deleted",
)
@audit(EventCategory.USER_ACTION, event_action="plugin_catalog_source_delete")
async def delete_plugin_catalog_source(
    source_id: UUID,
    service: Annotated[PluginCatalogService, Depends(get_catalog_service)],
) -> None:
    """Delete a plugin catalog source and its materialized marketplace entries.

    Requires: plugin:delete permission.
    """
    await service.delete_catalog_source(source_id)


@router.post(
    "/catalog-sources/{source_id}/sync",
    summary="Synchronize plugin catalog source",
    dependencies=[Depends(_perm_source_sync)],
    operation_id="sync_plugin_catalog_source",
    response_description="Catalog source after synchronization",
)
@audit(EventCategory.USER_ACTION, event_action="plugin_catalog_source_sync")
async def sync_plugin_catalog_source(
    source_id: UUID,
    service: Annotated[PluginCatalogService, Depends(get_catalog_service)],
) -> PluginCatalogSourceRead:
    """Synchronize one catalog source from its registry channel.

    Reads the catalog index artifact, verifies it, and materializes its
    entries as marketplace plugins. Sync failures are recorded on the source
    and reported through the registry error handler.

    Requires: plugin:sync permission.
    """
    return _source_read(await service.sync_catalog_source(source_id))


# ============================================================================
# Marketplace (available plugins)
# ============================================================================


@router.get(
    "/available",
    summary="List marketplace plugins",
    operation_id="list_marketplace_plugins",
    response_description="Paginated list of marketplace plugins",
)
async def list_marketplace_plugins(
    request: Request,
    service: Annotated[PluginCatalogService, Depends(get_catalog_service)],
    params: Annotated[MarketplacePluginListParams, Query()],
) -> MarketplacePluginListResponse:
    """List plugins available in the synchronized catalog sources."""
    return await service.list_marketplace_plugins(
        limit=params.limit,
        cursor=params.cursor,
        sort=params.sort,
        query_params_items=request.query_params.items(),
        include_total=params.include_total,
    )


@router.get(
    "/available/{marketplace_id}",
    summary="Get marketplace plugin",
    dependencies=[Depends(_perm_read)],
    operation_id="get_marketplace_plugin",
    response_description="Marketplace plugin details",
)
async def get_marketplace_plugin(
    marketplace_id: UUID,
    service: Annotated[PluginCatalogService, Depends(get_catalog_service)],
) -> MarketplacePluginRead:
    """Get one marketplace plugin with descriptor details and documentation."""
    return MarketplacePluginRead.model_validate(await service.get_marketplace_plugin(marketplace_id))


@router.post(
    "/available/{marketplace_id}/install",
    summary="Install marketplace plugin",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_perm_install)],
    operation_id="install_plugin",
    response_description="Installed plugin",
)
@audit(EventCategory.USER_ACTION, event_action="plugin_install")
async def install_plugin(
    marketplace_id: UUID,
    service: Annotated[PluginInstallService, Depends(get_install_service)],
) -> InstalledPluginRead:
    """Validate and install one marketplace plugin.

    The plugin artifact is re-read from the registry by its immutable digest
    and must pass the artifact validation pipeline before installation.

    Requires: plugin:install permission.
    """
    return InstalledPluginRead.model_validate(await service.install_plugin(marketplace_id))


@router.post(
    "/upload",
    summary="Upload and install a plugin artifact",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_perm_install)],
    operation_id="upload_plugin",
    response_description="Installed plugin",
)
@audit(EventCategory.USER_ACTION, event_action="plugin_upload")
async def upload_plugin(
    file: Annotated[UploadFile, File(description="OCI layout .oci.tar plugin artifact")],
    service: Annotated[PluginInstallService, Depends(get_install_service)],
) -> InstalledPluginDetail:
    """Validate and install a plugin directly from an uploaded .oci.tar archive.

    The archive is a portable OCI image layout built with ``syntara-plugin
    build``. It is unpacked in memory and must pass the same artifact
    validation pipeline as a registry install — no registry or catalog is
    involved.

    Requires: plugin:install permission.
    """
    content = await file.read()
    filename = file.filename or "upload.oci.tar"
    return InstalledPluginDetail.model_validate(await service.install_from_upload(filename, content))


# ============================================================================
# Installed plugins
# ============================================================================


@router.get(
    "/installed",
    summary="List installed plugins",
    operation_id="list_installed_plugins",
    response_description="Paginated list of installed plugins",
)
async def list_installed_plugins(
    request: Request,
    service: Annotated[PluginInstallService, Depends(get_install_service)],
    params: Annotated[InstalledPluginListParams, Query()],
) -> InstalledPluginListResponse:
    """List installed plugins."""
    return await service.list_installed_plugins(
        limit=params.limit,
        cursor=params.cursor,
        sort=params.sort,
        query_params_items=request.query_params.items(),
        include_total=params.include_total,
    )


@router.get(
    "/installed/{installed_id}",
    summary="Get installed plugin",
    dependencies=[Depends(_perm_read)],
    operation_id="get_installed_plugin",
    response_description="Installed plugin details",
)
async def get_installed_plugin(
    installed_id: UUID,
    service: Annotated[PluginInstallService, Depends(get_install_service)],
) -> InstalledPluginDetail:
    """Get one installed plugin including its descriptor and documentation."""
    return InstalledPluginDetail.model_validate(await service.get_installed_plugin(installed_id))


@router.delete(
    "/installed/{installed_id}",
    summary="Uninstall plugin",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(_perm_uninstall)],
    operation_id="uninstall_plugin",
    response_description="Plugin uninstalled",
)
@audit(EventCategory.USER_ACTION, event_action="plugin_uninstall")
async def uninstall_plugin(
    installed_id: UUID,
    service: Annotated[PluginInstallService, Depends(get_install_service)],
) -> None:
    """Uninstall one plugin.

    Requires: plugin:uninstall permission.
    """
    await service.uninstall_plugin(installed_id)
