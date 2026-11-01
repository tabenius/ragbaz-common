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
    if (entry.sha256 !== undefined && entry.sha256 !== null && !HEX.test(entry.sha256)) throw Error('invalid entry digest');
    const bound = entry.subject_sha256 === undefined ? s.sha256 : entry.subject_sha256;
    if (!HEX.test(bound)) throw Error('invalid entry subject digest');
    return Object.freeze({index, type:entry.type, label:entry.label, status: bound === s.sha256 ? entry.status : 'stale', sha256:entry.sha256 ?? null, subject_sha256:bound});
  });
  return Object.freeze({schema:value.schema, subject:Object.freeze({kind:s.kind,sha256:s.sha256}),entries:Object.freeze(entries),
    release_ready:false, authorization:'not-evaluated', verification:'host-required'});
}
export const evidenceTextEn = Object.freeze({
  aria:'Evidence inspection', title:'Evidence — inspection only', subject:'Subject',
  disclaimer:'Signature validity, signer authority and release approval are not determined here.',
  caption:'Submitted evidence and statuses (not independently verified)',
  type:'Type', label:'Label', status:'Claimed status', digest:'Digest',
  absent:'not provided', release:'Release authorization: not evaluated.'
});
export function evidenceHTML(projection, { messages = evidenceTextEn, lang = 'en' } = {}) {
  if (!/^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(lang)) throw Error('invalid display language');
  const strings = {};
  for (const key of Object.keys(evidenceTextEn)) {
    const value = messages?.[key];
    strings[key] = typeof value === 'string' && value.length > 0 && value.length <= 300 ? value : evidenceTextEn[key];
  }
  const result = inspectEvidence({schema:projection.schema,subject:projection.subject,entries:projection.entries});
  const esc = x => String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  return '<section lang="'+esc(lang)+'" aria-label="'+esc(strings.aria)+'"><h2>'+esc(strings.title)+'</h2><p>'+esc(strings.subject)+': '+esc(result.subject.kind)+' · <code>'+esc(result.subject.sha256)+'</code></p><p>'+esc(strings.disclaimer)+'</p><table><caption>'+esc(strings.caption)+'</caption><thead><tr><th scope="col">'+esc(strings.type)+'</th><th scope="col">'+esc(strings.label)+'</th><th scope="col">'+esc(strings.status)+'</th><th scope="col">'+esc(strings.digest)+'</th></tr></thead><tbody>'+
    result.entries.map(e=>'<tr><td>'+esc(e.type)+'</td><td>'+esc(e.label)+'</td><td>'+esc(e.status)+'</td><td><code>'+esc(e.sha256??strings.absent)+'</code></td></tr>').join('')+
    '</tbody></table><p>'+esc(strings.release)+'</p></section>';
}
