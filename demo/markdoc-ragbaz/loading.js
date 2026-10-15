/** Only a host-enabled meta-document interprets navigation parameters.
 * No origins, credentials, imports or policy relaxations come from the query. */
export function documentParameter(href, enabled = false) {
  if (!enabled) return null;
  const params = new URL(href).searchParams;
  if (params.getAll('document').length > 1 || params.getAll('sha256').length > 1) throw new Error('Duplicate document or SHA-256 parameter');
  const document = params.get('document');
  const digest = params.get('sha256');
  if (!document) {
    if (params.has('document') || digest !== null) throw new Error('A nonempty document URL is required');
    return null;
  }
  if (document.length > 8192 || /[\u0000-\u001f]/.test(document)) throw new Error('Invalid document URL parameter');
  if (digest !== null && !/^[a-f0-9]{64}$/i.test(digest)) throw new Error('Expected a 64-character SHA-256 digest');
  return { url: document, ...(digest ? { digest: digest.toLowerCase() } : {}) };
}
