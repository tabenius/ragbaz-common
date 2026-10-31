// Data-only 3D scene and CAD document contract. No renderer or executable content.
const TYPES = new Set(['box', 'sphere', 'cylinder', 'torus']);
const UNITS = new Set(['mm', 'cm', 'm', 'in']);
const finite = n => typeof n === 'number' && Number.isFinite(n);
function vec(v, n) { return Array.isArray(v) && v.length === n && v.every(finite); }
function fail(message) { throw new TypeError(message); }
export function validateGeometryDocument(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Expected object');
  if (input.version !== 'ragbaz.geometry/1') fail('Unsupported geometry version');
  if (!['three-scene', 'cad-model'].includes(input.profile)) fail('Unsupported profile');
  if (!UNITS.has(input.units)) fail('Unsupported units');
  if (!Array.isArray(input.objects) || input.objects.length > 128) fail('Invalid object count');
  const ids = new Set();
  const objects = input.objects.map((o, i) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) fail('Invalid object');
    if (typeof o.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(o.id) || ids.has(o.id)) fail('Invalid or duplicate object id');
    ids.add(o.id);
    if (!TYPES.has(o.type)) fail('Unsupported primitive');
    const expected = { box: 3, sphere: 1, cylinder: 2, torus: 2 }[o.type];
    if (!vec(o.size, expected) || o.size.some(n => n <= 0 || n > 100000)) fail('Invalid dimensions');
    if (o.type === 'torus' && o.size[1] >= o.size[0]) fail('Torus tube must be smaller than major radius');
    if (o.position !== undefined && (!vec(o.position, 3) || o.position.some(n => Math.abs(n) > 100000))) fail('Invalid position');
    if (o.rotation !== undefined && (!vec(o.rotation, 3) || o.rotation.some(n => Math.abs(n) > 1000))) fail('Invalid rotation');
    if (o.color !== undefined && (typeof o.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(o.color))) fail('Invalid color');
    return Object.freeze({ id: o.id, type: o.type, size: Object.freeze([...o.size]), position: Object.freeze([...(o.position || [0,0,0])]), rotation: Object.freeze([...(o.rotation || [0,0,0])]), color: o.color || '#5e9bb5' });
  });
  return Object.freeze({ version: input.version, profile: input.profile, units: input.units, objects: Object.freeze(objects) });
}
export function geometrySummary(doc) {
  const model = validateGeometryDocument(doc);
  return model.objects.map(o => ({ id: o.id, type: o.type, dimensions: o.size.join(' × ') + ' ' + model.units }));
}
export function geometrySvg(doc) {
  const model = validateGeometryDocument(doc);
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows = model.objects.map((o,i) => {
    const y = 35 + i * 27;
    return '<rect x="14" y="' + (y-15) + '" width="22" height="18" rx="3" fill="' + o.color + '"/><text x="46" y="' + y + '" fill="#d8e3e8" font-size="13">' + escape(o.id + ' · ' + o.type + ' · ' + o.size.join(' × ') + ' ' + model.units) + '</text>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Static geometry inventory" viewBox="0 0 640 ' + Math.max(80, model.objects.length * 27 + 45) + '"><rect width="100%" height="100%" fill="#17252d"/>' + rows + '</svg>';
}
