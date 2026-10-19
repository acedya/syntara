"""Plugin marketplace and installation models.

A plugin is a versioned declaration of workflow actions and triggers built
with the Syntara Plugin SDK and published to an OCI registry as a metadata
artifact. Discovery happens through a catalog-index artifact published on a
channel tag (see the ``syntara-plugin-sdk`` repository for the artifact
formats).

Three concepts are modeled here, mirroring the OpenShift OperatorHub flow:

- ``PluginCatalogSource`` — where to read a catalog from (registry origin,
  index repository, channel). Comparable to an OpenShift ``CatalogSource``.
- ``MarketplacePlugin`` — one catalog entry materialized during a catalog
  sync, enriched with details read from the plugin artifact. Comparable to
  an OpenShift ``PackageManifest``.
- ``InstalledPlugin`` — a plugin that passed the artifact validation
  pipeline and was installed into Syntara. Comparable to an installed
  OpenShift operator.
"""
