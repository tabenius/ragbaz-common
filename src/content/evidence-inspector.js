// Read-only portable evidence projection: never a cryptographic verifier.
const HEX = /^[0-9a-f]{64}$/;
const STATES = new Set(['passed','failed','stale','unavailable','pending','unknown','verified','unverified','revoked']);
const TYPES = new Set(['check','signature','attestation','audit','sbom','review','anchor']);
export function inspectEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('evidence object required');
  const raw = JSON.stringify(value);
  if (new TextEncoder().encode(raw).length > 65536) throw Error('evidence exceeds 64 KiB');
  if (value.schema !== 'ragbaz.evidence-inspector/1') throw Error('unsupported evidence schema');
  const s = value.subject;
  if (!s || typeof s !== 'object' || Array.isArray(s) || !['design','artifact','build','image','document'].includes(s.kind) || !HEX.test(s.sha256)) throw Error('invalid subject');
  if (!Array.isArray(value.entries) || value.entries.length > 128) throw Error('invalid entries');
  const entries = value.entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('invalid evidence entry');
    if (!TYPES.has(entry.type) || !STATES.has(entry.status)) throw Error('unsupported evidence type/status');
    if (typeof entry.label !== 'string' || entry.label.length < 1 || entry.label.length > 120 || /[\x00-\x1f]/.test(entry.label)) throw Error('invalid label');
    if (entry.sha256 !== undefined && !HEX.test(entry.sha256)) throw Error('invalid entry digest');
    const bound = entry.subject_sha256 === undefined ? s.sha256 : entry.subject_sha256;
    if (!HEX.test(bound)) throw Error('invalid entry subject digest');
    return Object.freeze({index, type:entry.type, label:entry.label, status: bound === s.sha256 ? entry.status : 'stale', sha256:entry.sha256 ?? null, subject_sha256:bound});
  });
  return Object.freeze({schema:value.schema, subject:Object.freeze({kind:s.kind,sha256:s.sha256}),entries:Object.freeze(entries),
    release_ready:false, authorization:'not-evaluated', verification:'host-required'});
}
export function evidenceHTML(projection) {
  // Only accept our normalized projection, not arbitrary markup.
  const result = inspectEvidence({schema:projection.schema,subject:projection.subject,entries:projection.entries});
  const esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  return '<section aria-label="Evidence inspection"><h2>Evidence — inspection only</h2><p>Subject: '+esc(result.subject.kind)+' · <code>'+esc(result.subject.sha256)+'</code></p><p>Signature validity, signer authority and release approval are not determined here.</p><table><caption>Submitted evidence and statuses (not independently verified)</caption><thead><tr><th scope="col">Type</th><th scope="col">Label</th><th scope="col">Claimed status</th><th scope="col">Digest</th></tr></thead><tbody>'+
    result.entries.map(e=>'<tr><td>'+esc(e.type)+'</td><td>'+esc(e.label)+'</td><td>'+esc(e.status)+'</td><td><code>'+esc(e.sha256??'not provided')+'</code></td></tr>').join('')+
    '</tbody></table><p>Release authorization: not evaluated.</p></section>';
}
