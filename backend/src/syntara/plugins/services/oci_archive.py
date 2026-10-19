"""Reading Syntara plugin artifacts from local OCI-layout archives.

A ``.oci.tar`` built by ``syntara-plugin build`` is a portable OCI image
layout: an ``index.json`` naming the artifact manifest and a
``blobs/sha256/<digest>`` tree holding every content-addressed blob. This
module unpacks such an archive entirely in memory and exposes the same
``get_manifest``/``get_blob`` surface as the registry client, so the install
validation pipeline can run unchanged against an uploaded file instead of a
registry.
"""

import json
import tarfile
from hashlib import sha256
from io import BytesIO
from typing import Any

from syntara.plugins.exceptions import PluginRegistryValidationError
from syntara.plugins.services.oci_client import OCI_IMAGE_MANIFEST_MEDIA_TYPE

# Uploads are tiny metadata archives; bound them well below request limits.
_MAX_ARCHIVE_BYTES = 64 * 1024 * 1024

_BLOB_MEMBER_PATTERN = "blobs/sha256/"


def _parse_json(content: bytes, what: str) -> dict[str, Any]:
    """Parse JSON bytes into a mapping, raising a registry validation error."""
    try:
        document = json.loads(content)
    except (ValueError, UnicodeDecodeError) as error:
        msg = f"{what} is not valid JSON"
        raise PluginRegistryValidationError(msg) from error
    if not isinstance(document, dict):
        msg = f"{what} is not a JSON object"
        raise PluginRegistryValidationError(msg)
    return document


class OciArchiveClient:
    """In-memory OCI-layout reader for one uploaded plugin archive."""

    def __init__(self, content: bytes, *, filename: str = "upload") -> None:
        """Parse the archive and verify the content addressing of every blob.

        Raises PluginRegistryValidationError when the archive is not a valid
        OCI layout or a blob does not hash to its declared digest.
        """
        if len(content) > _MAX_ARCHIVE_BYTES:
            msg = f"archive exceeds the {_MAX_ARCHIVE_BYTES} byte limit"
            raise PluginRegistryValidationError(msg)

        self._filename = filename
        self._blobs, index = self._read_members(content, filename)

        if index is None:
            msg = f"{filename} has no index.json (not an OCI layout archive)"
            raise PluginRegistryValidationError(msg)
        manifests = index.get("manifests")
        if not isinstance(manifests, list) or len(manifests) != 1:
            msg = f"{filename} must reference exactly one artifact manifest"
            raise PluginRegistryValidationError(msg)
        descriptor = manifests[0]
        if not isinstance(descriptor, dict):
            msg = f"{filename} has an invalid manifest descriptor"
            raise PluginRegistryValidationError(msg)
        manifest_digest = descriptor.get("digest")
        if not isinstance(manifest_digest, str) or manifest_digest not in self._blobs:
            msg = f"{filename} references a manifest blob that is missing from the archive"
            raise PluginRegistryValidationError(msg)

        self.manifest_digest = manifest_digest
        self.manifest = _parse_json(self._blobs[manifest_digest], "artifact manifest")

    @staticmethod
    def _read_members(content: bytes, filename: str) -> tuple[dict[str, bytes], dict[str, Any] | None]:
        """Extract and content-verify every member of the archive tarball.

        Returns the blob map keyed by digest and the parsed ``index.json``
        (or ``None`` when the archive has none).
        """
        blobs: dict[str, bytes] = {}
        index: dict[str, Any] | None = None
        try:
            with tarfile.open(fileobj=BytesIO(content), mode="r:*") as archive:
                for member in archive.getmembers():
                    if not member.isfile():
                        continue
                    name = member.name.lstrip("./")
                    extracted = archive.extractfile(member)
                    if extracted is None:
                        continue
                    data = extracted.read()
                    if name == "index.json":
                        index = _parse_json(data, "archive index.json")
                    elif name.startswith(_BLOB_MEMBER_PATTERN):
                        digest = f"sha256:{name[len(_BLOB_MEMBER_PATTERN) :]}"
                        if f"sha256:{sha256(data).hexdigest()}" != digest:
                            msg = f"blob {name} does not hash to its declared digest"
                            raise PluginRegistryValidationError(msg)
                        blobs[digest] = data
        except (OSError, tarfile.TarError) as error:
            msg = f"{filename} is not a readable tar archive: {error}"
            raise PluginRegistryValidationError(msg) from error
        return blobs, index

    @property
    def annotations(self) -> dict[str, str]:
        """Return the manifest annotations (display title, version)."""
        annotations = self.manifest.get("annotations")
        if not isinstance(annotations, dict):
            return {}
        return {str(key): str(value) for key, value in annotations.items() if isinstance(value, str)}

    def annotation_identity(self) -> tuple[str | None, str | None, str | None]:
        """Return the (namespace, name, version) declared by the manifest annotations."""
        title = self.annotations.get("org.opencontainers.image.title")
        version = self.annotations.get("org.opencontainers.image.version")
        namespace: str | None = None
        name: str | None = None
        if isinstance(title, str) and "/" in title:
            candidate_namespace, _, candidate_name = title.partition("/")
            if candidate_namespace and candidate_name:
                namespace = candidate_namespace
                name = candidate_name
        return namespace, name, version

    async def get_manifest(self, repository: str, reference: str) -> tuple[dict[str, Any], str, bytes]:
        """Return the manifest named by a digest reference (registry-client surface)."""
        del repository  # A single-artifact archive has no repository namespaces.
        if not reference.startswith("sha256:"):
            msg = f"archive manifests can only be read by digest, got {reference!r}"
            raise PluginRegistryValidationError(msg)
        content = self._blobs.get(reference)
        if content is None:
            msg = f"manifest {reference} is missing from {self._filename}"
            raise PluginRegistryValidationError(msg)
        document = _parse_json(content, "artifact manifest")
        if document.get("mediaType") != OCI_IMAGE_MANIFEST_MEDIA_TYPE:
            msg = "archive manifest has an unexpected mediaType"
            raise PluginRegistryValidationError(msg)
        return document, reference, content

    async def get_blob(self, repository: str, digest: str) -> bytes:
        """Return one blob by digest (registry-client surface)."""
        del repository
        content = self._blobs.get(digest)
        if content is None:
            msg = f"blob {digest} is missing from {self._filename}"
            raise PluginRegistryValidationError(msg)
        return content
