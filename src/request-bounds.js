// Dependency-free request body limits, and small JSON response helpers.
//
// Extracted from Mouseion src/identity/request-bounds.js.
// See PROVENANCE.md.

export const MAX_IMPORT_JSON_BYTES = 16 * 1024 * 1024;
export const REQUEST_BODY_TOO_LARGE = 'request_body_too_large';

/**
 * Buffer a request body up to `maxBytes`.
 *
 * The declared content-length is an early rejection only; the streamed total is
 * what is actually enforced, because a caller may lie about or omit the header.
 */
export async function readBoundedBody(request, maxBytes = MAX_IMPORT_JSON_BYTES) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(REQUEST_BODY_TOO_LARGE);
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel(REQUEST_BODY_TOO_LARGE).catch(() => {});
        throw new Error(REQUEST_BODY_TOO_LARGE);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2) + '\n', {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  });
}

/** A refusal with a stable machine-readable error code and no extra detail. */
export function problem(status, error, headers = {}) {
  return json({ error }, status, headers);
}
