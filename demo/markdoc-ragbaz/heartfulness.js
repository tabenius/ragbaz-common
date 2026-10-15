// Original host-owned botanical plates. No authored SVG or executable imports.
const leaf = (x, y, angle, scale = 1) => `<path transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" class="leaf" d="M0 0C-13-5-22-18-20-35-4-30 6-15 0 0Z"/><path transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})" class="vein" d="M0 0Q-10-14-17-29"/>`;
const rose = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})"><path class="petal" d="M0-18C8-25 19-17 18-10 31-7 25 7 18 10 16 24 4 27-3 19-16 25-26 14-20 4-30-5-20-17-12-15-10-26-1-26 0-18Z"/><path class="petal-line" d="M-12-15Q4-14 12-5 18 7 2 14-14 16-14 1-10-11 3-9 15-6 6 5-3 11-7 2-6-5 1-3 5 2 0 5"/><path class="petal-line" d="M-20 4Q-17-5-12-7M18-10Q11-12 8-12M18 10Q11 12 8 12M-3 19Q-9 13-8 11"/></g>`;
const svg = (viewBox, label, content) => `<svg xmlns="http://www.w3.org/2000/svg" class="heart-botanical" viewBox="${viewBox}" role="img" aria-label="${label}" focusable="false"><style>.heart-botanical .stem,.heart-botanical .vein,.heart-botanical .petal-line{fill:none;stroke:var(--heart-stem,#667252);stroke-width:1;stroke-linecap:round;stroke-linejoin:round}.heart-botanical .leaf{fill:var(--heart-leaf,#a7ac82);stroke:var(--heart-stem,#667252);stroke-width:.65}.heart-botanical .vein{stroke-width:.5}.heart-botanical .petal{fill:var(--heart-petal,#dbb3a0);stroke:var(--heart-rose,#986957);stroke-width:.8}.heart-botanical .petal-line{stroke:var(--heart-rose,#986957);stroke-width:.75}.heart-botanical .bud{fill:var(--heart-rose,#986957)}</style>${content}</svg>`;

export const BOTANICALS = Object.freeze({
  'climbing-rose': svg('0 0 180 310', 'Original climbing rose corner ornament', `
    <path class="stem" d="M29 298C15 249 55 228 39 190S21 130 54 101 70 56 52 31M40 192C73 176 67 143 85 130M40 251C65 245 78 224 70 203M54 101C91 106 112 79 111 56M55 57C80 48 100 33 149 39M26 281C48 272 51 263 50 255"/>
    ${[[28,277,-34,.9],[36,249,75,.8],[43,225,-38,1],[35,193,55,.85],[31,166,-40,.9],[38,139,63,.9],[56,108,-26,.85],[71,93,80,.8],[70,68,-18,.85],[94,47,50,.7],[121,37,73,.65],[68,231,85,.65],[78,156,12,.6],[104,81,-38,.6]].map(a => leaf(...a)).join('')}
    ${rose(51,33,.87)}${rose(111,57,.64)}${rose(71,202,.56)}
    <path class="stem" d="M86 130q-7-15 2-24M149 39q10-5 11-13M50 255q9-6 10-17"/>
    <ellipse class="bud" cx="88" cy="105" rx="3.2" ry="6" transform="rotate(12 88 105)"/><ellipse class="bud" cx="160" cy="25" rx="3" ry="5" transform="rotate(25 160 25)"/>
  `),
  'rose-divider': svg('0 0 360 76', 'Original rose and leaf section flourish', `
    <path class="stem" d="M24 43C81 55 119 24 180 38 241 24 279 55 336 43M44 46Q67 30 94 35M266 35Q293 30 316 46"/>
    ${[[68,45,55,.55],[103,39,-65,.58],[130,35,45,.48],[155,36,-55,.46],[292,45,-55,.55],[257,39,65,.58],[230,35,-45,.48],[205,36,55,.46]].map(a => leaf(...a)).join('')}
    ${rose(180,38,.68)}<circle class="bud" cx="18" cy="42" r="1.6"/><circle class="bud" cx="342" cy="42" r="1.6"/>
  `),
});

export function setupHeartfulness(enabled) {
  if (!enabled) return;
  const root = document.documentElement;
  const key = 'ragbaz.heartfulness.decoration';
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key)); } catch { /* Session-only decoration remains available. */ }
  root.dataset.heartOrnaments = ['plain', 'quiet', 'bloom'].includes(saved?.ornaments) ? saved.ornaments : 'bloom';
  root.dataset.heartTexture = saved?.texture === false ? 'smooth' : 'grain';
  const controls = document.createElement('fieldset'); controls.className = 'heart-options';
  controls.innerHTML = '<legend>Dress the page</legend><label for="heart-ornaments">Botanical ornaments<select id="heart-ornaments"><option value="plain">Plain</option><option value="quiet">A little</option><option value="bloom">Full bloom</option></select></label><label class="heart-texture-option"><input id="heart-texture" type="checkbox">Fine paper grain</label><p>A first proof, not a period reconstruction.</p>';
  document.querySelector('.appearance-option').after(controls);
  const select = document.getElementById('heart-ornaments'), texture = document.getElementById('heart-texture');
  select.value = root.dataset.heartOrnaments; texture.checked = root.dataset.heartTexture === 'grain';
  controls.addEventListener('change', () => {
    root.dataset.heartOrnaments = ['plain', 'quiet', 'bloom'].includes(select.value) ? select.value : 'bloom';
    root.dataset.heartTexture = texture.checked ? 'grain' : 'smooth';
    try { localStorage.setItem(key, JSON.stringify({ ornaments: root.dataset.heartOrnaments, texture: texture.checked })); } catch { /* Session-only. */ }
  });
  const frame = document.createElement('div'); frame.className = 'heart-frame'; frame.setAttribute('aria-hidden', 'true');
  frame.innerHTML = ['nw', 'ne', 'sw', 'se'].map(corner => `<span class="heart-corner ${corner}">${BOTANICALS['climbing-rose']}</span>`).join('');
  document.querySelector('.reading-layout').prepend(frame);
  const grain = document.createElement('div'); grain.className = 'heart-grain'; grain.setAttribute('aria-hidden', 'true');
  grain.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><filter id="heart-paper-grain"><feTurbulence type="fractalNoise" baseFrequency=".82" numOctaves="3" stitchTiles="stitch" seed="17"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#heart-paper-grain)"/></svg>';
  document.body.prepend(grain);
}

export function decorateHeartfulness(paper) {
  for (const heading of paper.querySelectorAll(':scope > article > h2')) {
    if (heading.previousElementSibling?.classList.contains('heart-flourish')) continue;
    const flourish = document.createElement('div'); flourish.className = 'heart-flourish'; flourish.setAttribute('aria-hidden', 'true');
    flourish.innerHTML = BOTANICALS['rose-divider']; heading.before(flourish);
  }
}
