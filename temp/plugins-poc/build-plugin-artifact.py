#!/usr/bin/env python3
"""Build a Syntara plugin OCI artifact with embedded implementation code.

Creates the same artifact layout the syntara-plugin-sdk produces (OCI image
layout with a Syntara plugin metadata artifact), plus a Python implementation
file in the content bundle — the piece the SDK deliberately leaves to the
Execution Plane. Used by the marketplace POC to demonstrate real code
execution from the artifact.

Usage:
    python3 build-plugin-artifact.py <plugin-workspace> <output.oci.tar>

The workspace must contain:
    plugin.yaml                      — plugin manifest (namespace/name/version)
    steps/<action>/manifest.yaml     — action manifest (kind: Action)
    steps/<action>/implementation.py — real Python code (JSON stdin → stdout)
    schemas/<action>.input.yaml      — JSON Schema for action inputs
    docs/README.md                   — plugin documentation
"""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
import tarfile
from io import BytesIO
from pathlib import Path
from typing import Any

import yaml

OCI_ARTIFACT_TYPE = "application/vnd.syntara.plugin.v1"
OCI_CONFIG_MEDIA_TYPE = "application/vnd.syntara.plugin.config.v1+json"
OCI_PLUGIN_MANIFEST_MEDIA_TYPE = "application/vnd.syntara.plugin.manifest.v1+yaml"
OCI_CONTENT_BUNDLE_MEDIA_TYPE = "application/vnd.syntara.plugin.content.v1.tar+gzip"
OCI_IMAGE_MANIFEST_MEDIA_TYPE = "application/vnd.oci.image.manifest.v1+json"


def sha256_digest(data: bytes) -> str:
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open() as f:
        return yaml.safe_load(f)


def build_content_bundle(workspace: Path, asset_paths: list[str]) -> bytes:
    """Create the deterministic tar.gz content bundle with all assets."""
    output = BytesIO()
    with gzip.GzipFile(fileobj=output, mode="wb", mtime=0, filename="") as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
            for rel_path in sorted(asset_paths):
                data = (workspace / rel_path).read_bytes()
                entry = tarfile.TarInfo(name=rel_path)
                entry.size = len(data)
                entry.mode = 0o644
                entry.uid = 0
                entry.gid = 0
                entry.uname = ""
                entry.gname = ""
                entry.mtime = 0
                entry.pax_headers = {}
                archive.addfile(entry, BytesIO(data))
    return output.getvalue()


def build_artifact(workspace: Path) -> bytes:
    """Build the complete .oci.tar for one plugin workspace."""

    plugin = load_yaml(workspace / "plugin.yaml")
    metadata = plugin["metadata"]
    namespace = metadata["namespace"]
    name = metadata["name"]
    version = metadata["version"]

    # Collect targets (action manifests) and their assets
    targets: list[dict[str, Any]] = []
    asset_paths: list[str] = []
    for target_path in plugin["spec"]["targets"]:
        action_manifest = load_yaml(workspace / target_path)
        action_meta = action_manifest["metadata"]
        action_name = action_meta["name"]
        runtime = action_manifest["spec"]["runtime"]

        # Input schema: inline or asset
        input_spec = action_manifest["spec"].get("input", {})
        if input_spec.get("kind") == "asset":
            schema_path = input_spec["path"]
            asset_paths.append(schema_path)
            input_schema = load_yaml(workspace / schema_path)
        else:
            input_schema = input_spec.get("value", {})

        # Output schema: inline or asset
        output_spec = action_manifest["spec"].get("output", {})
        if output_spec.get("kind") == "asset":
            schema_path = output_spec["path"]
            asset_paths.append(schema_path)
            output_schema = load_yaml(workspace / schema_path)
        else:
            output_schema = output_spec.get("value", {})

        # Implementation file (real code)
        implementation_path = runtime.get("implementation")
        if implementation_path:
            impl_file = workspace / implementation_path
            if not impl_file.exists():
                raise FileNotFoundError(f"implementation not found: {impl_file}")
            asset_paths.append(implementation_path)

        target = {
            "identity": f"{namespace}.{name}.{action_name}",
            "kind": "Action",
            "metadata": {
                "name": action_name,
                "displayName": action_meta.get("displayName", action_name),
                "description": action_meta.get("description", ""),
            },
            "runtime": dict(runtime),
            "input": input_schema,
            "output": output_schema,
            "sourcePath": target_path,
            "version": version,
        }
        targets.append(target)

    # Documentation
    docs_path = plugin["spec"]["documentation"]["path"]
    asset_paths.append(docs_path)
    docs_data = (workspace / docs_path).read_bytes()
    docs_digest = sha256_digest(docs_data)

    # Deduplicate and sort asset paths
    asset_paths = sorted(set(asset_paths))

    # Build the content bundle
    content_bundle = build_content_bundle(workspace, asset_paths)
    content_digest = sha256_digest(content_bundle)

    # Build the asset index
    asset_index: dict[str, Any] = {}
    for rel_path in asset_paths:
        data = (workspace / rel_path).read_bytes()
        digest = sha256_digest(data)
        if rel_path.endswith(".md"):
            media_type = "text/markdown"
        elif rel_path.endswith(".py"):
            media_type = "text/x-python"
        elif rel_path.endswith(".yaml") or rel_path.endswith(".yml"):
            media_type = "application/schema+yaml"
        else:
            media_type = "application/octet-stream"
        asset_index[rel_path] = {
            "digest": digest,
            "canonicalDigest": digest,
            "mediaType": media_type,
            "size": len(data),
        }

    # Build the plugin descriptor
    descriptor = {
        "apiVersion": "syntara.io/v1alpha1",
        "kind": "PluginDescriptor",
        "metadata": {
            "namespace": namespace,
            "name": name,
            "version": version,
            "displayName": metadata.get("displayName", name),
            "description": metadata.get("description", ""),
        },
        "spec": {
            "assets": asset_index,
            "contractBundleDigest": sha256_digest(canonical_json({"contracts": "v1alpha1"})),
            "documentation": {"digest": docs_digest, "path": docs_path},
            "targets": targets,
            "workloads": {},
        },
    }
    descriptor_bytes = canonical_json(descriptor)
    descriptor_digest = sha256_digest(descriptor_bytes)

    # Build the config
    config = {
        "apiVersion": "syntara.plugin.config/v1alpha1",
        "kind": "PluginArtifactConfig",
        "pluginDescriptorDigest": descriptor_digest,
        "assetIndex": asset_index,
    }
    config_bytes = canonical_json(config)
    config_digest = sha256_digest(config_bytes)

    # Build the OCI manifest
    oci_manifest = {
        "schemaVersion": 2,
        "mediaType": OCI_IMAGE_MANIFEST_MEDIA_TYPE,
        "artifactType": OCI_ARTIFACT_TYPE,
        "config": {
            "mediaType": OCI_CONFIG_MEDIA_TYPE,
            "digest": config_digest,
            "size": len(config_bytes),
        },
        "layers": [
            {
                "mediaType": OCI_PLUGIN_MANIFEST_MEDIA_TYPE,
                "digest": descriptor_digest,
                "size": len(descriptor_bytes),
                "annotations": {"org.opencontainers.image.title": "plugin.manifest.yaml"},
            },
            {
                "mediaType": OCI_CONTENT_BUNDLE_MEDIA_TYPE,
                "digest": content_digest,
                "size": len(content_bundle),
                "annotations": {"org.opencontainers.image.title": "content.tar.gz"},
            },
        ],
        "annotations": {
            "org.opencontainers.image.title": f"{namespace}/{name}",
            "org.opencontainers.image.version": version,
        },
    }
    manifest_bytes = canonical_json(oci_manifest)
    manifest_digest = sha256_digest(manifest_bytes)

    # Assemble the OCI layout tar
    output = BytesIO()
    with tarfile.open(fileobj=output, mode="w", format=tarfile.PAX_FORMAT) as archive:
        def add_file(name: str, data: bytes) -> None:
            entry = tarfile.TarInfo(name=name)
            entry.size = len(data)
            entry.mode = 0o644
            archive.addfile(entry, BytesIO(data))

        add_file("oci-layout", json.dumps({"imageLayoutVersion": "1.0.0"}).encode())
        add_file(
            "index.json",
            json.dumps(
                {
                    "schemaVersion": 2,
                    "manifests": [
                        {
                            "mediaType": OCI_IMAGE_MANIFEST_MEDIA_TYPE,
                            "artifactType": OCI_ARTIFACT_TYPE,
                            "digest": manifest_digest,
                            "size": len(manifest_bytes),
                            "annotations": {
                                "org.opencontainers.image.title": f"{namespace}/{name}",
                                "org.opencontainers.image.version": version,
                            },
                        }
                    ],
                }
            ).encode(),
        )
        add_file(f"blobs/sha256/{config_digest.removeprefix('sha256:')}", config_bytes)
        add_file(f"blobs/sha256/{descriptor_digest.removeprefix('sha256:')}", descriptor_bytes)
        add_file(f"blobs/sha256/{content_digest.removeprefix('sha256:')}", content_bundle)
        add_file(f"blobs/sha256/{manifest_digest.removeprefix('sha256:')}", manifest_bytes)

    return output.getvalue()


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    workspace = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    artifact = build_artifact(workspace)
    output_path.write_bytes(artifact)
    print(f"Built: {output_path} ({len(artifact)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
