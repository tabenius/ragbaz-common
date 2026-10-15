import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A portable, isolated parent; operators can keep all test artifacts under /srv.
export async function temporaryDirectory(prefix) {
  const parent = process.env.RAGBAZ_TEST_TMP || join(tmpdir(), 'opencode');
  await mkdir(parent, { recursive: true });
  return mkdtemp(join(parent, prefix));
}
