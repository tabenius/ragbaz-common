# Schemas

## `ragbaz.component.schema.json` — component manifest, 0.2.0

Every RAGBAZ project describes itself in one `ragbaz.component.json` that the
project owns. Published copy: `https://ragbaz.cc/schemas/ragbaz.component.schema.json`.

- **Required:** `schemaVersion` and `identity` (`id`, `name`, `lifecycle`). All
  0.1.0 sections (`commercial`, `capabilities`, `requires`, `provides`, `config`,
  `security`, `health`, `compatibility`, `docs`, `metadata`) stay optional and unchanged.
- **New in 0.2.0:** `identity.repository` (GitHub `owner/repo`) and `presentation`:
  - `presentation.featured` — one slide in the ragbaz.cc featured carousel: `order`,
    `status`, `label`, `title` (`' / '` = line break, `*word*` = accent), `description`,
    `tags`, `panel` (`label`, `bullets`, optional inner-SVG `icon`) and `links`.
  - `presentation.catalog` — descriptive fields of the public product catalog entry
    (`slug`, `name`, `tag`, `short`, `value`, `links`). Pricing, revenue and
    completion stay in `www.ragbaz/catalog/products.json`.
- Presentation is plain text. Consumers escape every string; `icon` is limited to
  `path`, `rect`, `circle`, `line` and `polyline` with geometric attributes.
- **Dependencies:** the optional `dependencies` array declares edges to other
  RAGBAZ components. Each entry has `componentId` (the depended-on component's
  `identity.id`), `kind` (`install`, `runtime`, `build` or `debug`), optional
  `version`, `optional` and `reason`. It records the relationship, not the pin:
  identity and repository/ref are resolved through
  `www.ragbaz/catalog/components.lock.json`. Ecosystem manifest groups
  (`pyproject.toml`, `Cargo.toml`, `package.json`) remain the source for external
  packages; this array is only for RAGBAZ-owned components. Frog materializes
  these edges as typed `repo_deps` rows for `frog repo affected` fan-out.

Consumers: `www.ragbaz` pins each manifest by repository and commit in
`catalog/components.lock.json`, copies them with `scripts/sync-components.mjs`,
and builds the carousel and catalog fields with `scripts/generate-from-components.mjs`.

## `ragbaz.component.schema.0.1.0.reconstructed.json`

The original 0.1.0 schema lived only in the unversioned workspace
(`/data/src/docs/schemas/`) and was lost. This file was inferred on 2026-11-14 from
the 11 surviving 0.1.0 manifests. Field names and nesting are real; its `required`
lists are inferred and stricter than the original was. Kept for reference only.
