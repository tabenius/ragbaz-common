// A bounded, data-only communication-geometry contract. No authored code/URLs.
export const CAD_SCHEMA = 'ragbaz.cad-study/v1';
export const ID = /^[a-z0-9][a-z0-9-]{0,95}$/;
const bad = () => { throw new TypeError('Invalid bounded CAD study'); };
function record(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) bad();
}
export function text(value, max, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) bad();
  return value;
}
export function id(value) { if (typeof value !== 'string' || !ID.test(value)) bad(); return value; }
function number(v, min = -10000, max = 10000) { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) bad(); return v; }
function vector(v, size = 3) { if (!Array.isArray(v) || v.length !== size) bad(); return v.map(n => number(n)); }
function list(v, max) { if (!Array.isArray(v) || v.length > max) bad(); return v; }
function unique(rows) { const ids = rows.map(r => r.id); if (new Set(ids).size !== ids.length) bad(); }
export function validateScene(input) {
  record(input, ['schema', 'id', 'name', 'description', 'parts', 'groups', 'hotspots']);
  if (input.schema !== CAD_SCHEMA) bad();
  const groups = list(input.groups, 32).map(g => {
    record(g, ['id', 'label', 'pivot', 'stage', 'path', 'axis', 'angle']);
    const out = { id: id(g.id), label: text(g.label, 200), pivot: vector(g.pivot), stage: vector(g.stage, 2) };
    if (!(out.stage[0] >= 0 && out.stage[0] < out.stage[1] && out.stage[1] <= 1)) bad();
    if (g.path !== undefined) {
      out.path = list(g.path, 16).map(v => vector(v));
      if (out.path.length < 3 || out.path[0].some(n => n !== 0)) bad();
    }
    if (g.axis !== undefined) {
      out.axis = vector(g.axis); out.angle = number(g.angle, -100, 100);
      if (Math.abs(Math.hypot(...out.axis) - 1) > 1e-6) bad();
    } else if (g.angle !== undefined) bad();
    if (!out.path && !out.axis) bad();
    return out;
  });
  unique(groups);
  const groupIds = new Set(groups.map(g => g.id));
  const parts = list(input.parts, 256).map(p => {
    record(p, ['id', 'label', 'shape', 'pos', 'size', 'color', 'opacity', 'rot', 'points', 'group']);
    if (!['box', 'cylinder', 'profile'].includes(p.shape) || !/^#[a-f0-9]{6}$/i.test(p.color)) bad();
    const length = p.shape === 'box' ? 3 : p.shape === 'cylinder' ? 2 : 1;
    const size = vector(p.size, length).map(n => number(n, .001, 10000));
    const out = { id: id(p.id), label: text(p.label, 240), shape: p.shape, pos: vector(p.pos), size, color: p.color };
    if (p.opacity !== undefined) out.opacity = number(p.opacity, .05, 1);
    if (p.rot !== undefined) out.rot = vector(p.rot).map(n => number(n, -100, 100));
    if (p.shape === 'profile') {
      out.points = list(p.points, 32).map(p => vector(p, 2));
      if (out.points.length < 3) bad();
    } else if (p.points !== undefined) bad();
    if (p.group !== undefined) { out.group = id(p.group); if (!groupIds.has(out.group)) bad(); }
    return out;
  });
  if (!parts.length) bad();
  unique(parts);
  const hotspots = list(input.hotspots, 16).map(h => {
    record(h, ['label', 'anchor', 'groups', 'text']);
    const out = { label: text(h.label, 240), anchor: vector(h.anchor), groups: list(h.groups, 32).map(id), text: text(h.text, 4000, true) };
    if (new Set(out.groups).size !== out.groups.length || out.groups.some(id => !groupIds.has(id))) bad();
    return out;
  });
  return { schema: CAD_SCHEMA, id: id(input.id), name: text(input.name, 200), description: text(input.description, 4000, true), parts, groups, hotspots };
}
