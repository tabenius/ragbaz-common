# Replicad support: execution and artifact contract

## Implemented in ragbaz-common

`@ragbaz/common/content/replicad-artifact` exports `inspectReplicadArtifact` and `replicadPreviewSVG`. The schema `ragbaz.replicad-artifact/1` supports:

- `name`: bounded display label
- `source`: `{language:"javascript",sha256:<exact source bytes digest>}`
- `preview`: `{format:"triangle-mesh/1",positions:[x,y,z,...],triangles:[a,b,c,...]}` (bounded finite numbers and indices)
- `exports`: optional `[{format:"step"|"stl",sha256:<digest>,bytes:<length>}]`

This contract is a portable, **read-only** viewer format. All supplied output hashes are *claims* until the host independently rehashes the actual bytes. The preview is a tessellation, not exact OpenCascade B-Rep, STEP validation, mathematical proof or release certification. The shared renderer never interprets/executes Replicad source code or loads external resources.

## Execution architecture (not implemented here)

Replicad 1.2.0 runs on OpenCascade.js/WASM and requires explicit `setOC(oc)` initialization. Its docs recommend a dedicated Web Worker for computation. The `replicad-cli` can export STEP/STL/JSON and SVG projections. A production runtime should:

1. Pin reviewed npm package, OpenCascade WASM binary, integrity hash and license notices; build them in a separate reproducible worker/container image.
2. Run user-authored modeling JavaScript **only** inside an isolated, untrusted execution origin or sandboxed worker with no account cookies, network credentials, file-system mounts or secrets. A worker alone is not a security boundary against hostile JavaScript running on the same origin. For headless execution, use an ephemeral resource-limited container, disable network and bind-mount only explicitly submitted files.
3. Enforce wall/CPU/memory limits and cap model complexity. Extract bounded mesh and STEP/STL artifacts only after successful computation.
4. Hash the exact source and output bytes, record executor version, OpenCascade build digest, build image, timing and logs. Record attestations and approvals in **Nostoi/WeftMark** outside the untrusted container. Generate the inspection manifest from those results.
5. Pieces may author source locally and request a deliberate build. Mouseion consumes only vetted static artifacts and provenance, never arbitrary scripts.

No supported user application should `eval`, dynamically import or execute submitted model source in its privileged page, even with an ordinary same-origin Web Worker.

## Upstream

- https://replicad.pages.dev/docs/use-as-a-library/
- https://github.com/sgenoud/replicad/tree/main/packages/replicad-cli
- https://www.npmjs.com/package/replicad

Before redistribution, recheck the license from the **exact pinned source version**, including the package's embedded license and bundled OpenCascade/WASM dependencies; ecosystem listings and source-file headers may differ.
