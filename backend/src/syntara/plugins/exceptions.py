"""Domain exceptions for the plugins domain."""

from uuid import UUID

from syntara.core.exception_registry import fastapi_exception
from syntara.core.exceptions import SyntaraError


@fastapi_exception(handler="syntara.plugins.error_handlers.plugin_error_handler")
class PluginError(SyntaraError):
    """Base exception for all plugin marketplace and installation errors."""


@fastapi_exception(handler="syntara.plugins.error_handlers.plugin_not_found_handler")
class PluginNotFoundError(PluginError):
    """Exception raised when a plugin resource is not found."""

    def __init__(self, resource: str, resource_id: UUID) -> None:
        """Initialize exception with the resource kind and ID."""
        self.resource = resource
        self.resource_id = resource_id
        super().__init__(f"{resource} {resource_id} not found")


@fastapi_exception(handler="syntara.plugins.error_handlers.plugin_name_conflict_handler")
class PluginNameConflictError(PluginError):
    """Exception raised when a catalog source name already exists."""

    def __init__(self, name: str) -> None:
        """Initialize exception with the conflicting name."""
        self.name = name
        super().__init__(f"Catalog source with name '{name}' already exists")


@fastapi_exception(handler="syntara.plugins.error_handlers.plugin_version_conflict_handler")
class PluginVersionConflictError(PluginError):
    """Exception raised when a different version of a plugin is installed."""

    def __init__(self, namespace: str, name: str, installed_version: str) -> None:
        """Initialize exception with the conflicting plugin identity."""
        self.namespace = namespace
        self.name = name
        self.installed_version = installed_version
        super().__init__(
            f"Plugin {namespace}/{name} is already installed at version {installed_version}; "
            "uninstall it before installing a different version"
        )


@fastapi_exception(handler="syntara.plugins.error_handlers.plugin_registry_error_handler")
class PluginRegistryError(PluginError):
    """Base exception for registry access failures during sync or install."""


class PluginRegistryConnectionError(PluginRegistryError):
    """Exception raised when the registry cannot be reached."""

    def __init__(self, message: str) -> None:
        """Initialize exception with the connection failure detail."""
        self.detail = message
        super().__init__(f"Registry connection failed: {message}")


class PluginRegistryUnauthorizedError(PluginRegistryError):
    """Exception raised when the registry rejects the configured credentials."""

    def __init__(self, message: str) -> None:
        """Initialize exception with the authorization failure detail."""
        self.detail = message
        super().__init__(f"Registry rejected the credentials: {message}")


class PluginRegistryArtifactNotFoundError(PluginRegistryError):
    """Exception raised when a registry artifact or blob is missing."""

    def __init__(self, message: str) -> None:
        """Initialize exception with the missing artifact detail."""
        self.detail = message
        super().__init__(f"Registry artifact not found: {message}")


class PluginRegistryValidationError(PluginRegistryError):
    """Exception raised when a registry response fails content verification."""

    def __init__(self, message: str) -> None:
        """Initialize exception with the verification failure detail."""
        self.detail = message
        super().__init__(f"Registry artifact failed verification: {message}")


@fastapi_exception(handler="syntara.plugins.error_handlers.plugin_validation_error_handler")
class PluginArtifactValidationError(PluginError):
    """Exception raised when a plugin artifact fails the install validation pipeline."""

    def __init__(self, check: str, detail: str) -> None:
        """Initialize exception with the failed check and its detail."""
        self.check = check
        self.detail = detail
        super().__init__(f"Plugin artifact validation failed at '{check}': {detail}")


@fastapi_exception(handler="syntara.plugins.error_handlers.plugin_sync_error_handler")
class PluginCatalogSyncError(PluginError):
    """Exception raised when a catalog synchronization cannot complete."""

    def __init__(self, source_name: str, detail: str) -> None:
        """Initialize exception with the source and failure detail."""
        self.source_name = source_name
        self.detail = detail
        super().__init__(f"Catalog sync for '{source_name}' failed: {detail}")
