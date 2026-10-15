// Aether begins here: original symbolic plates, not recovered correspondence.
export const AETHER_VARIANTS = Object.freeze({
  'aether-prima-materia': { title: 'Prima materia', slug: 'prima-materia', number: 'I', note: 'On what has not yet taken form' },
  'aether-sun-and-moon': { title: 'Sun and moon', slug: 'sun-and-moon', number: 'II', note: 'A study in correspondence' },
  'aether-blackening': { title: 'Blackening', slug: 'blackening', number: 'III', note: 'Notes from the unfinished dark' },
});

const plate = (label, body) => `<svg xmlns="http://www.w3.org/2000/svg" class="aether-plate" viewBox="0 0 800 330" role="img" aria-label="${label}"><desc>Original contemporary symbolic illustration, not a historical reproduction or a scientific observation.</desc><style>.aether-plate .line{fill:none;stroke:var(--aether-line,#998455);stroke-width:1}.aether-plate .fine{fill:none;stroke:var(--aether-line,#998455);stroke-width:.6;opacity:.7}.aether-plate .gold{fill:var(--aether-gold,#b79a57);stroke:none}.aether-plate .silver{fill:var(--aether-silver,#a2a9a7);stroke:none}.aether-plate .copper{fill:none;stroke:var(--aether-copper,#ad7056);stroke-width:1.7}.aether-plate text{font:10px Georgia,serif;letter-spacing:2px;fill:var(--muted,#716752);stroke:none}.aether-plate .large{font:italic 23px Georgia,serif;letter-spacing:0}</style>${body}</svg>`;

export const AETHER_PLATES = Object.freeze({
  'aether-prima-materia': plate('Prima materia: an incomplete vessel gathers scattered marks into an open circle', `
    <path class="fine" d="M110 278H690M400 24V300M255 61H545V278H255" stroke-dasharray="2 8"/>
    <circle class="line" cx="400" cy="166" r="105"/><circle class="fine" cx="400" cy="166" r="91" stroke-dasharray="2 8"/>
    <path class="copper" d="M350 233C307 194 326 136 372 112S467 120 478 158 457 239 409 245"/>
    <path class="line" d="M329 165Q366 210 404 175T476 164M316 229l-64 34M484 103l64-34"/>
    ${[[351,173,3],[369,152,2],[392,180,4],[415,150,2.5],[439,168,3],[381,196,2],[423,203,2.5],[280,215,1.7],[298,183,1.2],[310,258,2],[500,84,1.4],[524,97,2],[541,56,1.5],[366,88,1.6],[455,249,1.6]].map(([x,y,r])=>`<circle class="gold" cx="${x}" cy="${y}" r="${r}"/>`).join('')}
    <text x="116" y="153">THE UNFORMED</text><path class="fine" d="M225 150h58"/>
    <text x="568" y="186">A BEGINNING</text><path class="fine" d="M516 182h37"/>
    <text class="large" x="400" y="315" text-anchor="middle">materia, nondum forma</text>
  `),
  'aether-sun-and-moon': plate('Sun and moon: two distinct circular bodies approach without erasing one another', `
    <path class="fine" d="M80 166H720M400 25V303" stroke-dasharray="2 7"/>
    <ellipse class="fine" cx="400" cy="166" rx="257" ry="70"/><ellipse class="fine" cx="400" cy="166" rx="186" ry="131"/>
    <circle class="line" cx="289" cy="166" r="87"/><circle class="gold" cx="289" cy="166" r="65"/>
    ${Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return `<path class="line" d="M${289+Math.cos(a)*96} ${166+Math.sin(a)*96}l${Math.cos(a)*9} ${Math.sin(a)*9}"/>`}).join('')}
    <circle class="line" cx="511" cy="166" r="87"/><path class="silver" d="M511 101A65 65 0 1 0 511 231A48 65 0 0 1 511 101Z"/>
    <circle class="fine" cx="511" cy="166" r="65"/>
    <path class="copper" d="M381 166h38M400 147v38"/>
    <text x="289" y="42" text-anchor="middle">SOL</text><text x="511" y="42" text-anchor="middle">LUNA</text>
    <text class="large" x="400" y="318" text-anchor="middle">near, yet each entire</text>
  `),
  'aether-blackening': plate('Blackening: a broken orbit and a copper line remain visible inside an unfinished field', `
    <circle class="fine" cx="400" cy="159" r="112" stroke-dasharray="1 9"/>
    <path class="line" d="M489 206A102 102 0 1 0 374 258"/>
    <circle class="fine" cx="400" cy="159" r="71"/>
    <path class="fine" d="M206 159H594M400 22V291M325 84l150 150M325 234 475 84" opacity=".35"/>
    <path class="copper" d="M400 278V64M397 64l3-7 3 7"/>
    <circle class="gold" cx="400" cy="156" r="3"/>
    <text x="130" y="122">NOT YET</text><path class="fine" d="M210 119h66"/>
    <text x="563" y="216">NOT NOTHING</text><path class="fine" d="M524 213h25"/>
    <text class="large" x="400" y="319" text-anchor="middle">a place left to continue</text>
  `),
});

export function setupAether(id) {
  const variant = AETHER_VARIANTS[id];
  if (!variant) return;
  const root = document.documentElement;
  try { root.dataset.aetherPlates = localStorage.getItem('ragbaz.aether.plates') === 'off' ? 'off' : 'on'; } catch { root.dataset.aetherPlates = 'on'; }
  const label = document.createElement('label'); label.className = 'aether-art-option';
  label.innerHTML = '<input id="aether-plates" type="checkbox">Show symbolic plate';
  document.querySelector('.appearance-option').after(label);
  const checkbox = label.querySelector('input'); checkbox.checked = root.dataset.aetherPlates !== 'off';
  checkbox.addEventListener('change', () => {
    root.dataset.aetherPlates = checkbox.checked ? 'on' : 'off';
    try { localStorage.setItem('ragbaz.aether.plates', root.dataset.aetherPlates); } catch { /* Session-only. */ }
  });
  const layout = document.querySelector('.reading-layout');
  const front = document.createElement('header'); front.className = 'aether-front';
  front.innerHTML = `<div class="aether-imprint"><span>AETHER</span><span>STUDIES IN AFFECTION</span><span>FOLIO ${variant.number}</span></div><div class="aether-art">${AETHER_PLATES[id]}</div><p class="aether-study">${variant.note}</p>`;
  layout.prepend(front);
  const tail = document.createElement('footer'); tail.className = 'aether-tail';
  tail.innerHTML = `<p class="aether-colophon">A contemporary symbolic study. The words are new; the page remains open.</p><nav aria-label="Aether variants">${Object.entries(AETHER_VARIANTS).map(([key,v]) => `<a href="${location.protocol === 'file:' ? `../${v.slug}/index.html` : `/aether/${v.slug}/`}"${key === id ? ' aria-current="page"' : ''}>${v.number} · ${v.title}</a>`).join('')}</nav><p class="aether-loading">Open your own Markdown from Document tools, or use <code>?document=starter.md</code>.</p>`;
  layout.append(tail);
  const chooser = tail.querySelector('nav').cloneNode(true); chooser.className = 'aether-menu-variants';
  label.after(chooser);
}
