// Host-owned illustrations: authored documents may select these named plates,
// never supply SVG, scripts, external images, style or executable imports.
const frame = (title, description, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 360" role="img" aria-label="${title}. ${description}"><style>text{font-family:Georgia,serif;fill:var(--figure-ink,#233d43);font-size:17px}.small{font-family:system-ui,sans-serif;font-size:12px;letter-spacing:.04em}.muted{fill:var(--figure-muted,#536c70)}.orange{fill:var(--figure-accent,#995022)}.line{fill:none;stroke:var(--figure-line,#527c83);stroke-width:1.5}.box{fill:var(--figure-box,#f7faf7);stroke:var(--figure-rule,#9ab8ba);stroke-width:1}.accent{fill:var(--figure-accent,#995022);font-size:13px}</style>${body}</svg>`;

export const ILLUSTRATIONS = Object.freeze({
  weftmark: frame('WeftMark: workflow above storage', 'Proposed change, evidence and human review feed a ledger. JSONL and SQLite are alternative storage adapters beneath the same record model; neither storage nor a hash grants approval.', `
    <text x="24" y="30" class="small muted">01 / THE WORK IS THE MODEL; STORAGE IS AN ADAPTER</text>
    <rect x="24" y="62" width="196" height="84" rx="3" class="box"/><text x="42" y="94">Proposed change</text><text x="42" y="119" class="small muted">Intent and rationale</text>
    <rect x="262" y="62" width="196" height="84" rx="3" class="box"/><text x="280" y="94">Evidence</text><text x="280" y="119" class="small muted">Supporting observations</text>
    <rect x="500" y="62" width="196" height="84" rx="3" class="box"/><text x="518" y="94">Review decision</text><text x="518" y="119" class="small muted">Accountable judgment</text>
    <path d="M220 104h35m-6-5 6 5-6 5M458 104h35m-6-5 6 5-6 5" class="line"/>
    <path d="M122 146v33h476v-33M360 179v23m-5-6 5 6 5-6" class="line"/>
    <rect x="120" y="208" width="480" height="47" rx="3" class="box"/><text x="360" y="238" text-anchor="middle">WeftMark record model · historical ledger records</text>
    <path d="M360 255v20M228 275h264M228 275v15m264-15v15" class="line"/>
    <text x="228" y="314" text-anchor="middle">JSONL files</text><text x="492" y="314" text-anchor="middle">SQLite-backed tables</text>
    <text x="360" y="345" text-anchor="middle" class="accent">Storage preserves the record. Review supplies the judgment.</text>`),
  nostoi: frame('Nostoi: a chain, an attestation and a witness', 'Each record links to the digest of its predecessor. A signed checkpoint names a position in that chain. An independent witness retains the commitment, not proof of omitted content or human approval.', `
    <text x="24" y="30" class="small muted">02 / DIFFERENT EVIDENCE ANSWERS DIFFERENT QUESTIONS</text>
    <rect x="24" y="67" width="140" height="74" rx="3" class="box"/><text x="94" y="96" text-anchor="middle">Record 1</text><text x="94" y="120" text-anchor="middle" class="small muted">digest h₁</text>
    <rect x="226" y="67" width="140" height="74" rx="3" class="box"/><text x="296" y="96" text-anchor="middle">Record 2</text><text x="296" y="120" text-anchor="middle" class="small muted">links h₁ · digest h₂</text>
    <rect x="428" y="67" width="140" height="74" rx="3" class="box"/><text x="498" y="96" text-anchor="middle">Record 3</text><text x="498" y="120" text-anchor="middle" class="small muted">links h₂ · digest h₃</text>
    <path d="M226 104h-55m6-5-6 5 6 5M428 104h-55m6-5-6 5 6 5" class="line"/>
    <text x="296" y="168" text-anchor="middle" class="small muted">Hash links make edits detectable against a remembered head.</text>
    <path d="M498 141v56m-5-6 5 6 5-6" class="line"/>
    <rect x="340" y="205" width="316" height="57" rx="3" class="box"/><text x="498" y="229" text-anchor="middle">Signed checkpoint</text><text x="498" y="249" text-anchor="middle" class="small muted">ledger · position 3 · h₃ · authorized key</text>
    <path d="M340 233H207m6-5-6 5 6 5" class="line"/>
    <rect x="24" y="205" width="176" height="57" rx="3" class="box"/><text x="112" y="229" text-anchor="middle">Witness</text><text x="112" y="249" text-anchor="middle" class="small muted">retains the commitment</text>
    <path d="M234 187v102" style="stroke:var(--figure-rule,#9ab8ba)" stroke-width="1" stroke-dasharray="4 5"/><text x="112" y="292" text-anchor="middle" class="small muted">Independent administration</text>
    <text x="360" y="332" text-anchor="middle" class="accent">A valid signature is not truth, approval or proof of unseen records.</text>`),
});

export function decorateFigures(root, figures) {
  if (!Array.isArray(figures)) return;
  const doc = root.ownerDocument;
  for (const config of figures.slice(0, 20)) {
    if (!config || !Object.hasOwn(ILLUSTRATIONS, config.illustration)) continue;
    const figure = [...root.querySelectorAll('figure.semantic')].find(f => f.querySelector('.block-label')?.textContent === config.title);
    if (!figure) continue;
    const caption = doc.createElement('figcaption'); caption.textContent = config.title;
    figure.querySelector('.block-label').replaceWith(caption);
    const image = doc.createElement('div'); image.className = 'project-illustration';
    image.innerHTML = ILLUSTRATIONS[config.illustration];
    figure.prepend(image); figure.classList.add('project-card'); figure.id = `figure-${config.illustration}`;
  }
}
