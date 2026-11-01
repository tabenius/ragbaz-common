import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraClipPlanes } from '../src/content/three-adapter.js';

test('camera clipping remains ordered for microscopic CAD extents', () => {
  for (const extent of [1e-12, 1e-9, 1e-6, 1e-3, 1, 1000000]) {
    const { near, far } = cameraClipPlanes(extent);
    assert.ok(Number.isFinite(near) && Number.isFinite(far));
    assert.ok(near > 0 && far > near, `invalid clipping at extent ${extent}`);
  }
});

test('camera clipping handles invalid or empty extents with a safe default', () => {
  for (const extent of [0, -1, NaN, Infinity]) {
    assert.deepEqual(cameraClipPlanes(extent), cameraClipPlanes(1));
  }
});
