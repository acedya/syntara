"""RFC 9457 compliant error handlers for the plugins domain."""

from typing import TYPE_CHECKING

import structlog
from fastapi import Request, status
from fastapi.responses import JSONResponse

from syntara.core.error_handlers import PROBLEM_TYPES, create_problem_details_response

if TYPE_CHECKING:
    from syntara.plugins.exceptions import (
        PluginArtifactValidationError,
        PluginCatalogSyncError,
        PluginError,
        PluginNameConflictError,
        PluginNotFoundError,
        PluginRegistryError,
        PluginVersionConflictError,
    )

logger = structlog.stdlib.get_logger(__name__)


def plugin_error_handler(request: Request, exc: "PluginError") -> JSONResponse:
    """Handle PluginError with RFC 9457 format."""
    logger.error("Plugin operation failed", error=exc.message)
    return create_problem_details_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        problem_type=PROBLEM_TYPES["internal_error"],
        title="Plugin Operation Failed",
        detail=exc.message,
        code="PLUGIN_ERROR",
        retryable=False,
        instance=str(request.url),
    )


def plugin_not_found_handler(request: Request, exc: "PluginNotFoundError") -> JSONResponse:
    """Handle PluginNotFoundError with RFC 9457 format."""
    logger.warning("Plugin resource not found", resource=exc.resource, resource_id=str(exc.resource_id))
    return create_problem_details_response(
        status_code=status.HTTP_404_NOT_FOUND,
        problem_type=PROBLEM_TYPES["resource_not_found"],
        title="Plugin Resource Not Found",
        detail=exc.message,
        code="PLUGIN_NOT_FOUND",
        retryable=False,
        instance=str(request.url),
    )


def plugin_name_conflict_handler(request: Request, exc: "PluginNameConflictError") -> JSONResponse:
    """Handle PluginNameConflictError with RFC 9457 format."""
    logger.warning("Catalog source name conflict", name=exc.name)
    return create_problem_details_response(
        status_code=status.HTTP_409_CONFLICT,
        problem_type=PROBLEM_TYPES["name_conflict"],
        title="Catalog Source Name Conflict",
        detail=exc.message,
        code="PLUGIN_CATALOG_SOURCE_NAME_CONFLICT",
        retryable=False,
        instance=str(request.url),
    )


def plugin_version_conflict_handler(request: Request, exc: "PluginVersionConflictError") -> JSONResponse:
    """Handle PluginVersionConflictError with RFC 9457 format."""
    logger.warning("Plugin version conflict", namespace=exc.namespace, name=exc.name)
    return create_problem_details_response(
        status_code=status.HTTP_409_CONFLICT,
        problem_type=PROBLEM_TYPES["resource_conflict"],
        title="Plugin Version Conflict",
        detail=exc.message,
        code="PLUGIN_VERSION_CONFLICT",
        retryable=False,
        instance=str(request.url),
    )


def plugin_registry_error_handler(request: Request, exc: "PluginRegistryError") -> JSONResponse:
    """Handle PluginRegistryError with RFC 9457 format."""
    logger.error("Plugin registry access failed", detail=getattr(exc, "detail", exc.message))
    return create_problem_details_response(
        status_code=status.HTTP_502_BAD_GATEWAY,
        problem_type=PROBLEM_TYPES["service_unavailable"],
        title="Plugin Registry Unavailable",
        detail=exc.message,
        code="PLUGIN_REGISTRY_ERROR",
        retryable=True,
        instance=str(request.url),
    )


def plugin_validation_error_handler(request: Request, exc: "PluginArtifactValidationError") -> JSONResponse:
    """Handle PluginArtifactValidationError with RFC 9457 format."""
    logger.warning("Plugin artifact validation failed", check=exc.check, detail=exc.detail)
    return create_problem_details_response(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        problem_type=PROBLEM_TYPES["publish_validation"],
        title="Plugin Artifact Validation Failed",
        detail=exc.message,
        code="PLUGIN_ARTIFACT_VALIDATION_FAILED",
        retryable=False,
        instance=str(request.url),
    )


def plugin_sync_error_handler(request: Request, exc: "PluginCatalogSyncError") -> JSONResponse:
    """Handle PluginCatalogSyncError with RFC 9457 format."""
    logger.error("Plugin catalog sync failed", source=exc.source_name, detail=exc.detail)
    return create_problem_details_response(
        status_code=status.HTTP_502_BAD_GATEWAY,
        problem_type=PROBLEM_TYPES["service_unavailable"],
        title="Plugin Catalog Sync Failed",
        detail=exc.message,
        code="PLUGIN_CATALOG_SYNC_FAILED",
        retryable=True,
        instance=str(request.url),
    )
