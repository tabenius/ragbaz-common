# Replicad headless inspection bundle

The deployed Pieces and Mouseion CAD viewers accept `ragbaz.replicad-artifact/1` JSON. The bundler packages geometry **already generated** by a trusted Replicad/OpenCascade runtime. It does not execute modeling JavaScript or claim CAD validity.

Save the exact source script as `model.js`, export a mesh JSON containing flat numeric `vertices` and `triangles` arrays from Replicad's `shape.mesh()`, and optionally export STEP/STL.

```sh
node scripts/replicad-bundle.mjs \
  --name "Sample bracket" \
  --source model.js \
  --mesh mesh.json \
  --step bracket.step \
  --output bracket.replicad.json
```

Then open either `https://pieces.ragbaz.cc/replicad.html` or `https://mouseion.ragbaz.cc/replicad.html` and select the generated JSON. The viewer reads only the local JSON; no upload occurs.

The bundler uses exact SHA-256 of source/export bytes, validates geometry bounds, rejects symlinked inputs, limits file sizes, and refuses to overwrite an existing output file. It marks outputs **unverified** regardless of the digest computation. Signing, trusted executor identity, source-code sandboxing, STEP semantic validation and release approval are separate operations. Treat model source and STEP/STL inputs as untrusted; do not run a user-provided `model.js` in this CLI or inside a privileged browser origin.

The mesh format is a flat, zero-based triangle index buffer and flat XYZ coordinate buffer:

```json
{"vertices":[0,0,0,10,0,0,0,10,0],"triangles":[0,1,2]}
```
