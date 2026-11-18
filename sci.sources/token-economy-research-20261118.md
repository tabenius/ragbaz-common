# Token-economy research — handoff 2026-11-18

Written by: claude (Claude Code cloud session). Facts gathered while drafting
ragbaz.cc/token-economy/ and its technical note. Sources are catalogued in
`sources.yaml` next to this file (ids in brackets). Everything below is
**claim from cited sources**, checked only as far as stated; numbers marked
(n = 1) are our own single observations.

## Resume target

- Essay + note: tabenius/www.ragbaz#25 (branch `article/token-economy`),
  `site/token-economy/index.html` and `site/token-economy/measurements/paper.md`.
- This catalogue: tabenius/ragbaz-common#20 (branch `sci-sources`).
- Handoff standard and fleet history: tabenius/ragbaz-common#19.

## Where things stand

Scope decided by the owner: the essay is about **AI and how we take part in
shaping the change**: small steps, clarity over fear, single users and small
teams. World topics are kept below for later pieces, not for that essay.

### Our own measurements (technical note)
- Agent CLI start-up overhead: 28,424 → 3,146 tokens, $0.171 → $0.027 on one
  trivial prompt (−89% / −84%, n = 1) [sylvae-readme]. Codex ~11.5k tokens/6 s,
  OpenCode ~26k/13 s bootstrap [sylvae-phase2].
- mistral 7B local: disk-report 29,475 ms correct; summarize-diff 194,741 ms,
  one factual slip (n = 1 each) [sylvae-phase1, sylvae-runs].
- Real MVH (1,486 B JSON) → 965 B Hypomnema bundle; ceiling 256 KiB [mneme-evac].
- Fleet commits: mean/day 18.4 (Sep 15–Oct 15), 3.9 (Oct 16–29, 8 days ≤ 1),
  122.5 (Oct 30–Nov 2), 1.6 (Nov 3–12), 26.0 (Nov 13–18); 1,290 commits,
  28 repos [handoff-standard].

### AI and work
- WEF 2025: 170M jobs created, 92M displaced by 2030, net +78M; drivers include
  technology, green transition, demographics, not AI alone [wef-future-of-jobs-2025].
- IMF 2024: ~40% of global jobs exposed to AI, 60% in advanced economies; about
  half of exposed may be complemented rather than replaced [imf-ai-exposure-2024].
- Waymo ~500,000 paid driverless rides/week (Mar 2026), target 1M by end 2026.
- NREL truck platooning: following trucks ~5–10% fuel saving, lead 0–5% [nrel-platooning].

### Time, wellbeing, measuring progress
- SOU 2015:56 *Får vi det bättre?*: life-quality measures to **complement** GDP;
  SCB indicators 2016; "Nya mått på välstånd" in the 2017 spring budget
  [sou-2015-56, scb-livskvalitet-indikatorer].
- UN HLEG *Counting What Counts* (May 2026): 31-indicator dashboard beside GDP [un-beyond-gdp-2026].
- UK four-day week 2022: 61 firms; 54 still running a year on, 31 permanent
  (organiser-produced) [autonomy-4dw-uk].
- Mölndal orthopaedic operating unit (Sahlgrenska): six-hour day from
  2014–15, made permanent by SU board 2018; reported higher production, lower
  sick leave, easier recruiting (Hyltander); 32 h/week in 2025. No public
  evaluation with numbers found [su-molndal-6h-ortopedi].
- Svartedalen elderly care (Göteborg) 2015–16: staff felt better; ~8 MSEK/yr
  extra for 14 staff; small sick-leave drop disputed [svartedalen-6h].
- Arman 2010: health-care managers' work is fragmented; coordination/power,
  not only money, as bottlenecks. Nothing found on breaks/mindfulness [arman-2010].

### Cities and health
- OECD FUA urban centres (2021): green share / m² per person — Berlin 56.6% /
  123, Stockholm 60.5% / 157, New York (Greater) 55.7% / 190; satellite tree/
  shrub/grass, not public access [oecd-sdmx-green-fua; snapshot in snapshots/].
- Manhattan 2020: 1,694,251 people on ~59 km² land (~28,700/km²); Stockholm
  ~4,000–4,500/km². No Manhattan-only green share found.
- Greenspace meta-analysis (143 studies): lower cortisol, diabetes, all-cause
  mortality (ratio 0.69), associations [twohig-bennett-2018].
- Cycling to work: all-cause mortality HR 0.59 (UK Biobank, n = 264,337),
  observational [celis-morales-2017].

### Security of everyday digital life
- London: 81,365 phone thefts/robberies recorded 2024, 71,391 in 2025 (Met);
  ~14,000 of 587,498 phones stolen 2017–Feb 2024 recovered [met-police-news].

### Kept for later pieces (not the AI essay)
- Phosphate: Morocco/Western Sahara ~68% of reserves; OCP ~94–95% state-owned;
  China largest producer and restricts exports. Peak: Cordell 2009 ~2033 vs
  IFDC 2010 "several hundred years"; real risk is concentration
  [usgs-mcs, ocp-ownership, peak-phosphorus-gpri].
- Vertical farms: Bowery shut down Nov 2024, Plenty Chapter 11 Mar 2025,
  AeroFarms narrowed to microgreens; Gotham Greens rooftop greenhouses operate
  [gotham-greens-farms]. Microgreens: restaurants ~half of sales (vendor reports).
- Crime: legitimacy beats deterrence for compliance [tyler-legitimacy];
  inequality → violent crime, causality disputed [fajnzylber-2002]; early-life
  lead and low childhood self-control predict offending, size disputed
  [lead-crime-review-2023].
- Poverty: graduation programme lasting gains, returns 133–433% in 5 of 6
  countries [graduation-science-2015]; Kenya cash transfers, local multiplier
  2.5 [egger-2022-cash-ge]; microcredit modestly positive, not transformative
  [microcredit-six-rcts]; handwashing −~30% diarrhoea [cochrane-handwashing].

## Next action

Owner reviews the AI-focused essay draft on tabenius/www.ragbaz#25 and decides the leak-check question (allow `aether-tail` or rename the class in the reader).

## Decisions

- Essay scope: AI and our part in shaping it; no tour of world problems (owner, 2026-11-18).
- Numbers live in the technical note or in cited sources, never asserted bare (owner).
- Drafts first, short iterations, spend few tokens (owner).

## Blockers

- check-public-leaks flags `aether-tail` in the built paper; built HTML not committed.
- Mölndal evaluation numbers: request from SU registrator (public documents).

## Verify

    python3 -c "import yaml;print(len(yaml.safe_load(open('sci.sources/sources.yaml'))['sources']))"

## Do not

- Cite vendor market reports or advocacy sources as neutral fact; label them.
- Present associations (green space, cycling) as proven causes.

## Refs

- tabenius/www.ragbaz#25, tabenius/ragbaz-common#19, tabenius/ragbaz-common#20
- sci.sources/sources.yaml, sci.sources/snapshots/
