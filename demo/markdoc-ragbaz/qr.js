// Minimal QR Code Model 2 encoder for host-owned colophons: byte mode, error
// correction level M, versions 1–10 (up to 213 bytes). No dependency, no I/O.
// Follows ISO/IEC 18004 structure; tests decode the output with an independent reader.

const EC_M = Object.freeze({ // version: [ec codewords per block, [blocks, data codewords]…]
  1: [10, [1, 16]], 2: [16, [1, 28]], 3: [26, [1, 44]], 4: [18, [2, 32]], 5: [24, [2, 43]],
  6: [16, [4, 27]], 7: [18, [4, 31]], 8: [22, [2, 38], [2, 39]], 9: [22, [3, 36], [2, 37]], 10: [26, [4, 43], [1, 44]],
});
const ALIGNMENT = Object.freeze({ 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] });
const bit = (value, i) => ((value >>> i) & 1) !== 0;

// GF(256) arithmetic with the QR primitive polynomial x^8+x^4+x^3+x^2+1.
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const multiply = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
function generator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) { next[j] ^= poly[j]; next[j + 1] ^= multiply(poly[j], EXP[i]); }
    poly = next;
  }
  return poly;
}
function remainder(data, degree) {
  const gen = generator(degree), out = [...data, ...new Array(degree).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = out[i];
    if (factor) for (let j = 0; j < gen.length; j++) out[i + j] ^= multiply(gen[j], factor);
  }
  return out.slice(data.length);
}

function codewords(bytes, version) {
  const [ecLength, ...groups] = EC_M[version];
  const capacity = groups.reduce((sum, [blocks, size]) => sum + blocks * size, 0);
  const bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push(bit(value, i) ? 1 : 0); };
  push(0b0100, 4); push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((v, b) => (v << 1) | b, 0));
  for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad);
  const blocks = [];
  let offset = 0;
  for (const [count, size] of groups) for (let b = 0; b < count; b++) { const chunk = data.slice(offset, offset += size); blocks.push({ data: chunk, ec: remainder(chunk, ecLength) }); }
  const out = [];
  const longest = Math.max(...blocks.map(b => b.data.length));
  for (let i = 0; i < longest; i++) for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
  for (let i = 0; i < ecLength; i++) for (const block of blocks) out.push(block.ec[i]);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
];

function penalty(m) {
  const size = m.length;
  let score = 0;
  const lines = [];
  for (let i = 0; i < size; i++) { lines.push(m[i]); lines.push(m.map(row => row[i])); }
  for (const line of lines) {
    for (let i = 0; i < size;) {
      let j = i; while (j < size && line[j] === line[i]) j++;
      if (j - i >= 5) score += 3 + (j - i - 5);
      i = j;
    }
    const padded = [0, 0, 0, 0, ...line.map(Number), 0, 0, 0, 0].join('');
    for (const pattern of ['10111010000', '00001011101']) for (let k = padded.indexOf(pattern); k >= 0; k = padded.indexOf(pattern, k + 1)) score += 40;
  }
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
  }
  const dark = m.flat().filter(Boolean).length, total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/** Returns a square boolean matrix (true = dark), without the quiet zone. */
export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  const version = Object.keys(EC_M).map(Number).find(v => {
    const capacity = EC_M[v].slice(1).reduce((sum, [blocks, size]) => sum + blocks * size, 0);
    return 4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= capacity * 8;
  });
  if (!version) throw new Error('QR payload exceeds 213 bytes (version 10-M)');
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { modules[y][x] = dark; fixed[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, distance !== 2 && distance !== 4);
    }
  }
  const centres = ALIGNMENT[version], last = centres.length - 1;
  centres.forEach((cx, i) => centres.forEach((cy, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const drawFormat = mask => {
    const data = (0b00 << 3) | mask; // level M
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
    set(8, 7, bit(bits, 6)); set(8, 8, bit(bits, 7)); set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit(bits, i)); set(b, a, bit(bits, i)); }
  }
  const data = codewords(bytes, version);
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vertical : vertical;
      if (!fixed[y][x] && index < data.length * 8) { modules[y][x] = bit(data[index >>> 3], 7 - (index & 7)); index++; }
    }
  }
  let best, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = modules.map((row, y) => row.map((dark, x) => fixed[y][x] ? dark : dark !== MASKS[mask](x, y)));
    const saved = modules.map(row => [...row]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) modules[y][x] = candidate[y][x];
    drawFormat(mask);
    const score = penalty(modules);
    if (score < bestScore) { bestScore = score; best = modules.map(row => [...row]); }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) modules[y][x] = saved[y][x];
  }
  return best;
}

/** SVG element built through DOM APIs; one path, no text, no external resources. */
export function qrSVG(doc, text, { label = 'QR code' } = {}) {
  const matrix = qrMatrix(text), size = matrix.length, quiet = 4, ns = 'http://www.w3.org/2000/svg';
  let d = '';
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size + quiet * 2} ${size + quiet * 2}`);
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); svg.setAttribute('class', 'qr-code');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const background = doc.createElementNS(ns, 'rect');
  background.setAttribute('width', '100%'); background.setAttribute('height', '100%'); background.setAttribute('fill', '#ffffff');
  const path = doc.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('fill', '#000000');
  svg.append(background, path);
  return svg;
}
