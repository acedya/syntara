"""Seeder for the default plugin marketplace catalog source.

Creates (idempotently) one catalog source pointing at the local plugin
registry configured through ``PluginMarketplaceSettings``, so a fresh
installation can browse and install plugins out of the box.
"""

import structlog
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from syntara.core.config.base import get_settings
from syntara.core.models.user import User
from syntara.plugins.models.plugin_catalog_source import PluginCatalogSource

logger = structlog.stdlib.get_logger(__name__)


async def seed_plugin_catalog_source(session: AsyncSession) -> None:
    """Upsert the default plugin catalog source.

    Owned by the seeded admin user. Never overwrites user edits: if the
    source already exists the seeder is a no-op.
    """
    settings = get_settings()
    existing = await session.exec(select(PluginCatalogSource).where(col(PluginCatalogSource.name) == "local-registry"))
    if existing.first() is not None:
        return

    admin_result = await session.exec(select(User).where(col(User.username) == "admin"))
    admin = admin_result.first()
    if admin is None:
        msg = "No admin user found — cannot seed the plugin catalog source. Ensure authz seeder runs first."
        raise RuntimeError(msg)

    source = PluginCatalogSource(
        name="local-registry",
        description="Local development plugin registry seeded by default",
        registry_origin=settings.plugin_catalog_origin,
        repository=settings.plugin_catalog_repository,
        channel=settings.plugin_catalog_channel,
        username=settings.plugin_catalog_username,
        password=settings.plugin_catalog_password,
        labels={},
        created_by=admin.id,
        updated_by=admin.id,
    )
    session.add(source)
    await session.commit()
    logger.info(
        "seeded default plugin catalog source",
        origin=settings.plugin_catalog_origin,
        repository=settings.plugin_catalog_repository,
    )
