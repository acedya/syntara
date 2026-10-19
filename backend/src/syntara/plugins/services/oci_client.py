"""Minimal async OCI Distribution client for reading Syntara artifacts.

Implements just enough of the OCI Distribution Spec v2 to pull Syntara plugin
and catalog-index artifacts from a registry: manifest fetch by tag or digest
and blob fetch with content verification. Uploads, signing, and bearer-token
challenges are intentionally out of scope for this POC reader.

The media types and artifact layout consumed here are defined by the
``syntara-plugin-sdk``:

- plugin artifact:      ``application/vnd.syntara.plugin.v1``
- plugin config:        ``application/vnd.syntara.plugin.config.v1+json``
- plugin manifest:      ``application/vnd.syntara.plugin.manifest.v1+yaml``
- content bundle:       ``application/vnd.syntara.plugin.content.v1.tar+gzip``
- catalog-index:        ``application/vnd.syntara.catalog-index.v1``
- catalog-index config: ``application/vnd.syntara.catalog-index.config.v1+json``
- catalog-index layer:  ``application/vnd.syntara.catalog-index.content.v1+json``
"""

from collections.abc import Mapping
from hashlib import sha256
from typing import Any
from urllib.parse import quote

import httpx

from syntara.plugins.exceptions import (
    PluginRegistryArtifactNotFoundError,
    PluginRegistryConnectionError,
    PluginRegistryUnauthorizedError,
    PluginRegistryValidationError,
)

OCI_IMAGE_MANIFEST_MEDIA_TYPE = "application/vnd.oci.image.manifest.v1+json"
OCI_MANIFEST_ACCEPT_HEADER = (
    "application/vnd.oci.image.manifest.v1+json,"
    "application/vnd.oci.image.index.v1+json,"
    "application/vnd.docker.distribution.manifest.v2+json"
)

# Bound blob reads so a hostile registry cannot exhaust memory (16 MiB).
_MAX_BLOB_BYTES = 16 * 1024 * 1024
_REQUEST_TIMEOUT_SECONDS = 15.0
_HTTP_BAD_REQUEST = 400
_HTTP_UNAUTHORIZED = 401
_HTTP_NOT_FOUND = 404


def _sha256_digest(content: bytes) -> str:
    """Return the OCI sha256 digest string for content bytes."""
    return f"sha256:{sha256(content).hexdigest()}"


class OciRegistryClient:
    """Read-only OCI Distribution client bound to one registry origin.

    POC scope: plain HTTP is accepted for loopback development registries and
    credentials are passed as HTTP Basic auth without a token exchange.
    """

    def __init__(
        self,
        origin: str,
        *,
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        """Create a client for one registry origin (e.g. http://localhost:5000)."""
        self._origin = origin.rstrip("/")
        self._username = username
        self._password = password

    async def get_manifest(self, repository: str, reference: str) -> tuple[dict[str, Any], str, bytes]:
        """Fetch one manifest by tag or digest.

        Returns the parsed manifest document, its verified digest, and the
        raw bytes. Raises PluginRegistryValidationError when the response is
        not a JSON OCI manifest.
        """
        url = f"{self._origin}/v2/{quote(repository, safe='/')}/manifests/{quote(reference, safe=':')}"
        response = await self._request("GET", url, headers={"Accept": OCI_MANIFEST_ACCEPT_HEADER})
        content = response.content
        digest = _sha256_digest(content)
        # A digest reference must round-trip: the registry must return the
        # exact bytes named by the digest (immutability check).
        if reference.startswith("sha256:") and reference != digest:
            msg = f"registry returned manifest bytes that do not match {reference}"
            raise PluginRegistryValidationError(msg)
        try:
            document: dict[str, Any] = response.json()
        except ValueError as error:
            msg = "registry manifest is not valid JSON"
            raise PluginRegistryValidationError(msg) from error
        return document, digest, content

    async def get_blob(self, repository: str, digest: str) -> bytes:
        """Fetch one blob by digest and verify its content hash.

        Raises PluginRegistryValidationError when the returned bytes do not
        match the requested digest or exceed the size bound.
        """
        url = f"{self._origin}/v2/{quote(repository, safe='/')}/blobs/{quote(digest, safe=':')}"
        response = await self._request("GET", url)
        content = response.content
        if len(content) > _MAX_BLOB_BYTES:
            msg = f"registry blob {digest} exceeds the {_MAX_BLOB_BYTES} byte limit"
            raise PluginRegistryValidationError(msg)
        if _sha256_digest(content) != digest:
            msg = f"registry blob content does not match {digest}"
            raise PluginRegistryValidationError(msg)
        return content

    async def _request(self, method: str, url: str, headers: Mapping[str, str] | None = None) -> httpx.Response:
        """Issue one request with optional basic auth and bounded timeout."""
        auth = None
        if self._username and self._password:
            auth = (self._username, self._password)
        try:
            async with httpx.AsyncClient(
                timeout=_REQUEST_TIMEOUT_SECONDS,
                auth=auth,
                verify=False,  # noqa: S501 — POC: local registries use self-signed or plain HTTP
                follow_redirects=False,
            ) as client:
                response = await client.request(method, url, headers=headers)
        except httpx.HTTPError as error:
            msg = f"could not reach registry at {self._origin}: {error}"
            raise PluginRegistryConnectionError(msg) from error

        if response.status_code == _HTTP_NOT_FOUND:
            msg = f"registry does not have {url} (404)"
            raise PluginRegistryArtifactNotFoundError(msg)
        if response.status_code == _HTTP_UNAUTHORIZED:
            msg = f"registry rejected the credentials for {self._origin} (401)"
            raise PluginRegistryUnauthorizedError(msg)
        if response.status_code >= _HTTP_BAD_REQUEST:
            msg = f"registry returned HTTP {response.status_code} for {url}"
            raise PluginRegistryConnectionError(msg)
        return response


def descriptor_digest(descriptor: dict[str, Any]) -> str:
    """Return the digest of one OCI content descriptor."""
    value = descriptor.get("digest")
    if not isinstance(value, str) or not value:
        msg = "manifest descriptor is missing a digest"
        raise PluginRegistryValidationError(msg)
    return value


def descriptor_media_type(descriptor: dict[str, Any]) -> str:
    """Return the media type of one OCI content descriptor."""
    value = descriptor.get("mediaType")
    if not isinstance(value, str) or not value:
        msg = "manifest descriptor is missing a mediaType"
        raise PluginRegistryValidationError(msg)
    return value


def find_layer_by_media_type(manifest: dict[str, Any], media_type: str) -> dict[str, Any] | None:
    """Return the first manifest layer with the requested media type."""
    layers = manifest.get("layers")
    if not isinstance(layers, list):
        return None
    for layer in layers:
        if isinstance(layer, dict) and layer.get("mediaType") == media_type:
            return layer
    return None
