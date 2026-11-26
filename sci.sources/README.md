# sci.sources

Places facts come from: open-government APIs, statistical databases, GIS
services and key documents, collected while writing RAGBAZ papers and essays.
`sources.yaml` is the list. `snapshots/` holds small extracts actually fetched,
named with the fetch date, so a cited number can be traced to bytes.

- `verified` says what was checked: a date and a value means fetched;
  `listed` means seen in search results only.
- Prefer a primary API or document over press coverage; note when an entry is
  secondary.
- These are skeletons for later adapters (an MCP tool or a Worker per API).
  Nothing here holds credentials.
