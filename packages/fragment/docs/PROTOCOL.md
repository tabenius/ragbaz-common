# Fragment protocol 0.1 (draft)

## Design contract

One semantic model has multiple views: author YAML, agent JSON, JSON-pointer AST,
interactive HTML and paged print. Humans see short names and readable reasons;
software sees enumerations, explicit values and diagnostic paths. No LLM is needed
to validate, resolve named themes, bind slots, convert formats or evaluate a target.

`fragment: "0.1"` pins the protocol, not a floating major version. Unknown versions
and unknown fields fail validation. Future/vendor data goes under `extensions`.
Every document has an id and a kind (`template` or `document`). Empty or null
bindings are distinct: null means missing, an empty string is an intentional value.

## Authoring profile

YAML 1.2 core scalars restricted to JSON-compatible values. One document; string
mapping keys; unique keys; no custom tags, anchors, aliases or merge keys; no NaN,
infinity or integers outside ±(2^53−1). Input is limited to 1 MB and semantic depth
64. Quote dates, version numbers and strings that resemble booleans or numbers.
The browser rejects duplicates in JSON as well, since JSON input follows the same
YAML parser. Exported JSON is ordinary JSON, not a proprietary DSL.

Converting is 1:1 for semantic values; comments and author formatting are not in
JSON and therefore are not round-tripped. TOML is not implemented: a future adapter
must define nulls and heterogeneous arrays without silently changing meaning.

## Metadata

| Field | Meaning |
|---|---|
| `meta.title` | Literal title |
| `meta.created` | RFC 3339 timestamp with numeric UTC offset or Z |
| `meta.timezone` | IANA timezone; offset must match at the timestamp instant |
| `meta.disclosure` | `public`, `nda-required`, or `private` |
| `page` | A4, orientation, margin in mm, body size in pt |

Disclosure labels travel with exports. They are classification, not authorization.
A sharing service must independently enforce its policy. Creation time never
silently changes on rendering. System font faces vary across operating systems;
this draft makes the font strategy explicit rather than claiming pixel identity.

## Capability constraints

```yaml
constraints:
  - capability: color
    level: require
    scope: print
    reason: Color carries information that has no equivalent encoding.
  - capability: internet
    level: degrade
    scope: screen
    reason: An optional web font would improve this layout.
    fallback: Use the bundled or system font.
```

Capabilities: color, monochrome, portrait, landscape, mouse, touch, keyboard,
animation, interaction, internet, storage. These names are the structured equivalent
of require-color, require-monochrome and so on. Scope is screen, print or all.
Multiple requirements mean AND; require-mouse plus require-touch requires both.
No implicit OR is inferred. An OR expression is a future versioned addition.

For a given scope, requiring both color and monochrome, or both portrait and
landscape, is invalid. Opposing requirements in disjoint scopes are legal. Merely
preferring one is not a hard requirement. A missing required capability blocks;
a missing soft capability degrades; an unknown hard capability also blocks until
verified. Unknown soft capabilities degrade with `observed: unknown`. Required
and soft entries are evaluated individually; hard outcomes take priority.

The host provides a map of true / false / null values. Missing means unknown.
`navigator.onLine` does not prove a remote API works. Pointer/touch heuristics do
not prove a human can use a mouse or keyboard. The studio exposes assumptions for
inspection and simulation. It probes localStorage with a caught write/remove;
it does not prescribe storage technology for the protocol.

Print sets interaction, animation, mouse, touch and keyboard to false; orientation
and requested output mode come from print controls. Internet and storage retain
host knowledge, which may be unknown. A downstream print pipeline can provide
verified capabilities instead. Internet-required live data cannot be replaced by
an embedded snapshot without authoring a different, explicitly labeled artifact.

Reduced motion disables animation in the screen capability environment. Static
printing displays quiz answers and exact graph relationships. Every meaningful
degradation should state its fallback; the schema allows omission so an author
can leave that choice visibly unfinished in a draft.

## Themes: intent versus authority

```yaml
theme:
  requested: gruvbox-dark-solarized-ragbaz
  resolved: gruvbox-dark-solarized-ragbaz
  provenance: fragment-registry/0.1
  font: system-serif
  tokens:
    background: '#282828'
    foreground: '#ebdbb2'
    # ... all tokens are required in an actual theme
```

Lowercase dash-separated words express decreasing importance. Exact registry
matches win. Otherwise each shared word receives weight 2^-position in the
requested slug; maximum sum wins, registry order breaks ties. This deterministic
approximation is not a claim to understand arbitrary style language. The requested
slug remains intact; resolved slug and provenance show what happened. Expanded
six-digit sRGB tokens in the artifact are authoritative even if the registry later
changes. An importer must not re-resolve an exported theme implicitly.

Tokens: background, foreground, surface, primary, secondary, accent, border, muted;
syntax-keyword, syntax-string, syntax-number, syntax-comment; info, success, warning,
danger, figure, form. Roles preserve meaning across palettes. Never rely on color
alone: add labels, marks or text. Monochrome cannot recover information originally
encoded only by color; such a fragment should require color.

## Content, relationships and templates

Blocks have stable ids, a type, title and text. Supported types are heading,
paragraph, callout, code, figure-group, quiz, form. Figure groups have a shared
explanation plus per-figure label, value and explanation. Quizzes declare options
and a zero-based correct answer; the form example explains how to bind the draft.
Future interactive form schemas belong to extensions until standardized.

Graph nodes have ids and labels. Edges reference existing ids and declare weights
in [0,1]. The sample uses authored affinities; statistical correlations would need
method and data provenance in an extension. CoSE is the spring default, with circle
and grid alternatives. Desired spring length is `40 + 160 × (1 − weight)` in graph
units. Simulation and viewport can vary the final coordinates. Printed edges keep
exact values regardless of layout. No LLM is needed to derive the layout inputs.

Portable binding is `{{ identifier }}` in block text, titles, figure strings and
quiz options. Names are flat ASCII identifiers. Values are JSON primitives.
Unbound names render `⟦name · unbound⟧`. Templates may contain holes; documents may
not. Text is placed via DOM textContent. A binding cannot inject markup, execute
code or recursively introduce another template pass.

For larger templates, use the implemented Rust MiniJinja adapter with the model
as context. Python Jinja2 and JavaScript Nunjucks are the intended ecosystem
adapters, not shipped interpreters. Keep shared templates to substitutions,
conditionals and simple loops, and test them per engine: the full languages are
not identical. `examples/summary.jinja` is a simple compatible example. Awk/sed can
edit simple literal lines or placeholders, but use the parser/CLI for structural
updates or untrusted values, then validate. Do not apply sed to JSON escaping.

## LLM additions and exact compilation

```yaml
additional:
  - id: zoom-intent
    intent: Assign zoom in and out to + and - keys.
    status: accepted
    patch: []  # the default keyboard profile already does this
```

The natural-language field may request augmenting or overriding a simpler rule.
It remains a proposal until a host translates it into exact operations, shows the
diff, validates the resulting model and records acceptance. Status is provenance,
not an execution instruction. This draft records add/replace/remove JSON-pointer
patch operations but deliberately does not apply them automatically. A later
compiler can produce a resolved artifact and record its source and decisions.
Unknown instructions remain visible; they never disappear into guessed behavior.

Precedence: protocol invariants → validated concrete artifact → explicitly chosen
runtime options within those invariants. Advisory language and theme hints do not
override an exact value at runtime. Printing options can change orientation, but a
contradicting hard requirement then blocks print instead of silently being dropped.

## AST and interoperability

AST nodes contain `{path, type, value}` for scalars or `{path, type, children}` for
containers. Paths are RFC 6901 JSON pointers with ~ and / escaped. Object order is
not semantic; array order is. Diagnostics in JS include paths, codes and messages;
Rust currently emits readable strings. A shared machine diagnostic envelope and
WASM bindings are planned; both current cores already share the schema and fixtures.

## References

- JSON Schema: https://json-schema.org/draft-07
- JSON Pointer: https://www.rfc-editor.org/rfc/rfc6901
- MiniJinja syntax: https://docs.rs/minijinja/latest/minijinja/syntax/
- Cytoscape layouts: https://js.cytoscape.org/#layouts

These are implementation foundations, not a claim that Fragment is an established
external standard. 0.1 is a reviewable protocol proposal.
