# RAGBAZ fleet handoff standard — v1

**Status:** proposed by a Claude session on 2026-11-18 at the owner's request.
Becomes the fleet standard when the owner accepts it. This is step 4 ("publish
a handoff") of the [cooperation protocol](../AGENTS.md#join-work-hand-off),
made concrete.

**Why:** work moves between Claude, Codex, OpenCode models (for example Big
Pickle) and people. It also stops without warning: token budgets run out, CI
quotas run out, hardware fails, offices move. The handoff has to exist *before*
the interruption, be readable with nothing but `git` and `cat`, and
improve in the background instead of being written once at the end.

The fleet already has the pieces. This standard names them and connects them:

| Existing piece | Where | Role in this standard |
|---|---|---|
| `.handoff/` Markdown + `active-tasks.json` | remote-android, token-economy, frog, rebsync | Layer 1 and the index, now one format |
| MVH JSON (`urn:hypomnema:mvh:v1`) | `tabenius/mneme` `schemas/mvh.schema.json` | Layer 0, the machine-readable minimum |
| `mneme evac build/push` (Hypomnema) | mneme | Cold-start bundle of all MVHs (USB, LAN, Dash) |
| Personal handoff MCP (`handoffs_upload`/`list`/`download`) | ragbaz-dash `docs/HANDOFF-MCP.md` | Off-host, revisioned copy keyed by harness + session |
| Handoff context budget (compact/standard/deep) | WeftMark `docs/contracts/handoff-context-budget-v0.md` | How a receiver loads a handoff without blowing its context |
| Workspace handoff + OCI evidence | rebekah `docs/contracts/workspace-handoff.schema.json` | Evidence bundles when a handoff ships artefacts |
| `rebsync` / `rbq` git layer | tabenius/rebsync | Moves repos, `.handoff/` included, when GitHub is unreachable |

## 1. Two layers, written in this order

**Layer 0 — MVH, written in about 2 minutes, kept current.**
`.handoff/<slug>.mvh.json`, valid MVH v1 (all fields required, unknown
fields rejected, ≤16 KiB per field). Write it at the **start** of
non-trivial work, and update it at every milestone and before any risky step:
a long build, a migration, a release, or a low budget.
`scripts/handoff.py new` drafts it from git state.

**Layer 1 — narrative, improved in the background.**
`.handoff/<slug>-YYYYMMDD.md`. Required headings, in this order:

1. `## Resume target`: repository, branch, commit, PR links, and the worktree
   as a hint only (paths differ per host).
2. `## Where things stand`: each line marked **verified** (with the command
   and date) or **claim**. Unknown stays unknown.
3. `## Next action`: one concrete step, then the queue.
4. `## Decisions`: what was decided, by whom, and what was rejected.
5. `## Blockers`: what is missing and who can unblock it.
6. `## Verify`: exact commands a receiver runs first.
7. `## Do not`: the traps already hit, such as "do not edit the pinned cert".
8. `## Refs`: commits, PRs, sessions (harness + id), other handoffs.

Optional: `## Suggested opening prompt` (token-economy's pattern), `## Known
gaps`, `## History`. Append dated sections rather than rewriting them (frog's
pattern), and keep the newest first.

The two layers must agree. `handoff.py check` fails when the MVH `next_action`
or `blockers` disappear from the narrative.

## 2. Index: `.handoff/active-tasks.json`

One per repository, schema `ragbaz.handoff-index/1`
([schema](../schemas/ragbaz.handoff-index.schema.json)). It merges the two
shapes already in use:

```json
{
  "schema": "ragbaz.handoff-index/1",
  "updatedOn": "2026-11-18",
  "tasks": [{
    "slug": "android-release",
    "title": "Release the Rebeqah APK",
    "priority": "p1",
    "status": "in_progress",
    "branch": "fix-ndk-home",
    "handoff": ".handoff/android-release-20261118.md",
    "mvh": ".handoff/android-release.mvh.json",
    "owner": "human-owner",
    "blockers": ["Find the keystore that holds the b093a277 certificate"],
    "frogTaskId": null
  }]
}
```

Paths are **repository-relative**. Absolute paths such as `/home/xyzzy/...` break on
every other host. Priorities use frog's `p0`–`p3`. Status is one of `todo`,
`in_progress`, `blocked`, `paused`, `done`.

`AGENTS.md` (or `CLAUDE.md`) starts with one line that points at the
active handoffs, so every harness finds them without being told:

```markdown
Read `.handoff/active-tasks.json` and the handoffs it lists before resuming.
```

## 3. Where a handoff lives, in order of durability

1. **Git, on the working branch, pushed.** This is the primary copy. A handoff that
   exists only in a chat, a scratchpad or an unpushed worktree does not
   exist.
2. **Dash personal handoff MCP**: `handoffs_upload` with
   `session: {harness, id, source}`. This gives an off-host revision history
   when git push is blocked (quota, outage, offline).
3. **Hypomnema bundle**:
   `mneme evac build --input .handoff/*.mvh.json --output ~/Handoffs/evac/evac-$(date +%Y%m%d-%H%M).json.gz --observed-at $(date +%s)`.
   Put it on USB or LAN for cold starts after hardware failure. `mneme evac push` sends it to Dash.
4. **`rbq` (rebsync)** carries whole repos, `.handoff/` included, between hosts
   without GitHub.

## 4. Content rules

- **Never** put passwords, tokens, private keys, keystore passwords or session
  cookies in a handoff, an MVH, an index, a commit message or a chat. Name the
  secret and where it lives (`~/.config/...`, a repo secret name, a password
  manager entry), never its value. `handoff.py check` refuses common secret
  shapes. It is a backstop, not a guarantee.
- Name the harness and model that wrote each section (`claude`, `codex`,
  `opencode/big-pickle`, a person). Do not attribute work to a participant
  without evidence.
- Report checks actually run (command, result, date). Plans are not evidence.
- Prefer commit SHAs and PR URLs to prose descriptions of state.
- Keep it short. Layer 1 targets WeftMark's `standard` budget (about 1,600
  tokens of mandatory content); move detail into linked docs. Receivers
  materialize `compact`, `standard` or `deep`. They never replay transcripts.

## 5. Finding earlier work (for a receiving agent)

Search all of these before concluding nothing exists:

```bash
# handoffs in every checkout on this host
find ~ -xdev -path '*/.handoff/*' \( -name '*.md' -o -name '*.json' \) -newermt 2026-09-01 2>/dev/null
# handoff commits across a repo's branches
git log --all --since=2026-09-01 -i --grep='handoff\|hypomnema\|evac' --format='%h %ad %an %s' --date=short
# OpenCode sessions (Big Pickle et al.), indexed locally by mneme
mneme query history_search --args '{"query":"handoff OR hypomnema OR evac","mode":"fts","limit":50}'
mneme query history_aggregate --args '{"group_by":"day","since_ms":1788213600000}'
# Claude Code transcripts and Codex sessions (not indexed by mneme)
grep -l -i handoff ~/.claude/projects/*/*.jsonl 2>/dev/null | head
ls -t ~/.codex/sessions 2>/dev/null | head
# off-host copies: Dash MCP tool handoffs_list {"includeHistory": true}
```

mneme indexes **OpenCode only**. Claude and Codex histories are not in it.
Say which sources you searched.

## 6. Tooling

`scripts/handoff.py` (Python 3.10+, standard library only, copy it anywhere):

| Command | What it does |
|---|---|
| `handoff.py new SLUG --goal "…"` | Drafts `.handoff/SLUG.mvh.json` and `.handoff/SLUG-YYYYMMDD.md` from git state: remote, branch, HEAD, dirty files, unpushed commits, recent log. Upserts the index. Never overwrites. |
| `handoff.py check [PATH…]` | Lints MVH limits, required headings, MVH/narrative agreement, repository-relative index paths and secret shapes. Exit 1 on failure. |
| `handoff.py index` | Rebuilds `active-tasks.json` entries for handoffs missing from it. |

Semi-automation is up to each host. Examples: run `new` from a session-start
hook, `check` in pre-push, and `mneme evac build` from a systemd timer or cron.
The standard requires none of them.

## 7. Versioning

The schema id `ragbaz.handoff-index/1` and this document version move together.
Changes are additive within v1. Record superseded rules with their date, and
do not silently rewrite them.
