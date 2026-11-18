#!/usr/bin/env python3
"""RAGBAZ fleet handoffs (docs/HANDOFF-STANDARD.md): draft, lint and index.

Standard library only; copy this file into any repository or host.

  handoff.py new SLUG --goal "..." [--title ...] [--priority p1] [--next ...]
  handoff.py check [PATH ...]        # default: everything under .handoff/
  handoff.py index                   # add missing handoffs to active-tasks.json
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

INDEX_SCHEMA = 'ragbaz.handoff-index/1'
MVH_FIELDS = ['project', 'worktree', 'goal', 'state', 'open_files', 'decisions', 'blockers',
              'next_action', 'verify', 'refs', 'last_verified_at']
MVH_LISTS = {'open_files', 'decisions', 'blockers', 'verify', 'refs'}
HEADINGS = ['Resume target', 'Where things stand', 'Next action', 'Decisions', 'Blockers',
            'Verify', 'Do not', 'Refs']
TEXT_MAX, LIST_MAX, FILE_MAX = 16 * 1024, 128, 256 * 1024
PROJECT_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$')
SLUG_RE = re.compile(r'^[a-z0-9][a-z0-9._-]{0,63}$')
# Backstop only: shapes of secrets that should never be in a handoff.
SECRET_RES = [
    (re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'), 'private key block'),
    (re.compile(r'\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'), 'GitHub token'),
    (re.compile(r'\b(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,})\b'), 'API key'),
    (re.compile(r'\bAKIA[0-9A-Z]{16}\b'), 'AWS access key'),
    (re.compile(r'\bxox[abpr]-[A-Za-z0-9-]{10,}\b'), 'Slack token'),
    (re.compile(r'\b[A-Za-z0-9_]*(PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PASSPHRASE)[A-Za-z0-9_]*\s*[=:]\s*'
                r'(?![\s"\'`]*(\$|<|\{\{|\*\*\*|REPLACE|read -rs|env:|secrets\.))["\']?[^\s"\'`]{6,}', re.I),
     'assignment of a secret-like variable'),
]


def git(*args: str, cwd: Path) -> str:
    try:
        return subprocess.run(['git', *args], cwd=cwd, text=True, capture_output=True, check=True).stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ''


def repo_root() -> Path:
    top = git('rev-parse', '--show-toplevel', cwd=Path.cwd())
    return Path(top) if top else Path.cwd()


def repo_slug(root: Path) -> str:
    url = git('remote', 'get-url', 'origin', cwd=root)
    m = re.search(r'[:/]([^/:]+/[^/]+?)(?:\.git)?/?$', url)
    return m[1] if m else root.name


def today() -> str:
    return dt.date.today().isoformat()


# ---------------------------------------------------------------- new

def cmd_new(a: argparse.Namespace) -> int:
    root = repo_root()
    if not SLUG_RE.match(a.slug):
        return fail(f'slug {a.slug!r}: use lowercase letters, digits, . _ - (max 64)')
    hdir = root / '.handoff'
    hdir.mkdir(exist_ok=True)
    mvh_path = hdir / f'{a.slug}.mvh.json'
    md_path = hdir / f'{a.slug}-{today().replace("-", "")}.md'
    for p in (mvh_path, md_path):
        if p.exists():
            return fail(f'{p.relative_to(root)} exists; handoffs are never overwritten, edit it instead')

    slug = repo_slug(root)
    branch = git('rev-parse', '--abbrev-ref', 'HEAD', cwd=root) or 'unknown'
    head = git('rev-parse', 'HEAD', cwd=root) or 'unknown'
    dirty = [l[3:] for l in git('status', '--porcelain', cwd=root).splitlines() if l[3:] and not l[3:].startswith('.handoff/')]
    upstream = git('rev-parse', '--abbrev-ref', '@{u}', cwd=root)
    unpushed = git('log', '--oneline', f'{upstream}..HEAD', cwd=root).splitlines() if upstream else ['(no upstream: branch not pushed)']
    recent = git('log', '--format=%h %ad %s', '--date=short', '-8', cwd=root).splitlines()
    nxt = a.next or 'REPLACE: one concrete next step'
    author = a.author or 'REPLACE: harness/model or person'

    state = [f'claim: drafted by handoff.py from git state on {today()}; not yet reviewed']
    if dirty:
        state.append(f'claim: {len(dirty)} uncommitted path(s): commit or describe them before relying on this handoff')
    if unpushed and unpushed[0]:
        state.append(f'claim: {len(unpushed)} unpushed commit(s): push, or the handoff does not exist off this host')

    mvh = {
        'project': slug.split('/')[-1][:64] if PROJECT_RE.match(slug.split('/')[-1]) else 'project',
        'worktree': str(root),
        'goal': a.goal,
        'state': '; '.join(state),
        'open_files': (dirty or ['(none uncommitted)'])[:LIST_MAX],
        'decisions': ['(none recorded yet)'],
        'blockers': ['(none recorded yet)'],
        'next_action': nxt,
        'verify': ['git fetch origin && git status'],
        'refs': [f'git:{slug}@{head}', f'branch:{branch}', f'author:{author}'],
        'last_verified_at': 0,
    }
    md = f"""# {a.title or a.goal} — handoff {today()}

Written by: {author}. Layer 1 of the fleet handoff standard
(ragbaz-common docs/HANDOFF-STANDARD.md); machine-readable minimum in
`{mvh_path.relative_to(root)}`. Lines are **claims** until marked **verified**
with the command and date.

## Resume target

- Repository: `{slug}`, branch `{branch}`, commit `{head[:12]}`
- Worktree on the writing host (hint only): `{root}`
- Pull requests: REPLACE or "none"

## Where things stand

{chr(10).join('- ' + s for s in state)}
- Recent commits:
{chr(10).join('  - ' + r for r in recent) or '  - (none)'}
{('- Uncommitted:' + chr(10) + chr(10).join('  - ' + d for d in dirty[:30])) if dirty else ''}

## Next action

{nxt}

## Decisions

- (none recorded yet)

## Blockers

- (none recorded yet)

## Verify

    git fetch origin && git checkout {branch} && git status

## Do not

- Put secrets in this file. Name where a secret lives, never its value.

## Refs

- git:{slug}@{head}
"""
    mvh_path.write_text(json.dumps(mvh, indent=2, ensure_ascii=False) + '\n')
    md_path.write_text(re.sub(r'\n{3,}', '\n\n', md))
    upsert_index(root, {'slug': a.slug, 'title': (a.title or a.goal)[:200], 'priority': a.priority,
                        'status': 'in_progress', 'branch': branch,
                        'handoff': str(md_path.relative_to(root)), 'mvh': str(mvh_path.relative_to(root)),
                        'blockers': []})
    print(f'drafted {md_path.relative_to(root)} and {mvh_path.relative_to(root)}; edit the REPLACE markers, then run: handoff.py check')
    return 0


# ---------------------------------------------------------------- index

def load_index(root: Path) -> dict:
    p = root / '.handoff' / 'active-tasks.json'
    if p.exists():
        data = json.loads(p.read_text())
        if data.get('schema') == INDEX_SCHEMA:
            return data
        # Pre-standard shapes (schemaVersion 1.0.0 / active_handoffs): keep tasks, normalise later.
        return {'schema': INDEX_SCHEMA, 'updatedOn': today(), 'tasks': data.get('tasks', []), '_legacy': True}
    return {'schema': INDEX_SCHEMA, 'updatedOn': today(), 'tasks': []}


def save_index(root: Path, data: dict) -> None:
    data.pop('_legacy', None)
    data['updatedOn'] = today()
    (root / '.handoff' / 'active-tasks.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def upsert_index(root: Path, task: dict) -> None:
    data = load_index(root)
    tasks = [t for t in data['tasks'] if t.get('slug') != task['slug']]
    tasks.append({k: v for k, v in task.items() if v is not None})
    data['tasks'] = tasks
    save_index(root, data)


def cmd_index(_a: argparse.Namespace) -> int:
    root = repo_root()
    data = load_index(root)
    known = {t.get('handoff') for t in data['tasks']}
    added = 0
    for md in sorted((root / '.handoff').glob('*.md')):
        rel = str(md.relative_to(root))
        if rel in known:
            continue
        slug = re.sub(r'-\d{8}$', '', md.stem).lower()
        mvh = root / '.handoff' / f'{slug}.mvh.json'
        title = next((l.lstrip('# ').strip() for l in md.read_text().splitlines() if l.startswith('# ')), slug)
        data['tasks'].append({'slug': slug if SLUG_RE.match(slug) else 'task', 'title': title[:200],
                              'priority': 'p2', 'status': 'todo', 'handoff': rel,
                              **({'mvh': str(mvh.relative_to(root))} if mvh.exists() else {})})
        added += 1
    save_index(root, data)
    print(f'index: {len(data["tasks"])} task(s), {added} added')
    return 0


# ---------------------------------------------------------------- check

def check_mvh(path: Path, problems: list[str]) -> dict | None:
    raw = path.read_bytes()
    if len(raw) > FILE_MAX:
        problems.append(f'{path}: larger than 256 KiB (mneme evac refuses it)')
    try:
        mvh = json.loads(raw)
    except json.JSONDecodeError as e:
        problems.append(f'{path}: invalid JSON: {e}')
        return None
    if not isinstance(mvh, dict):
        problems.append(f'{path}: MVH must be an object')
        return None
    missing = [f for f in MVH_FIELDS if f not in mvh]
    extra = [f for f in mvh if f not in MVH_FIELDS]
    if missing:
        problems.append(f'{path}: missing MVH fields {missing}')
    if extra:
        problems.append(f'{path}: unknown MVH fields {extra} (MVH v1 rejects them)')
    if 'project' in mvh and not (isinstance(mvh['project'], str) and PROJECT_RE.match(mvh['project'])):
        problems.append(f'{path}: project must match {PROJECT_RE.pattern}')
    for f in MVH_FIELDS:
        if f in ('project', 'last_verified_at') or f not in mvh:
            continue
        vals = mvh[f] if f in MVH_LISTS else [mvh[f]]
        if f in MVH_LISTS and (not isinstance(vals, list) or len(vals) > LIST_MAX):
            problems.append(f'{path}: {f} must be a list of at most {LIST_MAX}')
            continue
        for v in vals:
            if not isinstance(v, str) or not v.strip() or len(v.encode()) > TEXT_MAX:
                problems.append(f'{path}: {f} entries must be nonblank text of at most 16 KiB')
                break
    lva = mvh.get('last_verified_at')
    if not isinstance(lva, int) or isinstance(lva, bool) or lva < 0:
        problems.append(f'{path}: last_verified_at must be a non-negative integer (0 = none)')
    return mvh


def check_md(path: Path, mvh: dict | None, problems: list[str], warnings: list[str]) -> None:
    text = path.read_text(errors='replace')
    found = [h.strip() for h in re.findall(r'^## (.+)$', text, re.M)]
    missing = [h for h in HEADINGS if h not in found]
    if missing:
        problems.append(f'{path}: missing required headings {missing}')
    if 'REPLACE' in text:
        warnings.append(f'{path}: still contains REPLACE markers')
    if mvh and isinstance(mvh.get('next_action'), str):
        key = mvh['next_action'].strip()[:40]
        if key and key not in text:
            problems.append(f'{path}: MVH next_action ({key!r}…) is not in the narrative; update one of them')


def check_secrets(path: Path, problems: list[str]) -> None:
    for n, line in enumerate(path.read_text(errors='replace').splitlines(), 1):
        for rx, what in SECRET_RES:
            if rx.search(line):
                problems.append(f'{path}:{n}: looks like: {what}; name where the secret lives, never its value')


def check_index(root: Path, problems: list[str]) -> None:
    p = root / '.handoff' / 'active-tasks.json'
    if not p.exists():
        problems.append(f'{p}: missing; run handoff.py index')
        return
    data = json.loads(p.read_text())
    if data.get('schema') != INDEX_SCHEMA:
        problems.append(f'{p}: schema is not {INDEX_SCHEMA} (pre-standard shape); run handoff.py index to migrate')
    for t in data.get('tasks', []):
        for k in ('handoff', 'mvh'):
            v = t.get(k)
            if v is None:
                continue
            if v.startswith(('/', '~')) or '../' in v:
                problems.append(f'{p}: task {t.get("slug")}: {k} {v!r} is host-specific; use a repository-relative path')
            elif not (root / v).exists():
                problems.append(f'{p}: task {t.get("slug")}: {k} {v!r} does not exist')
        if t.get('priority') not in ('p0', 'p1', 'p2', 'p3'):
            problems.append(f'{p}: task {t.get("slug")}: priority must be p0-p3')
        if t.get('status') not in ('todo', 'in_progress', 'blocked', 'paused', 'done'):
            problems.append(f'{p}: task {t.get("slug")}: unknown status {t.get("status")!r}')


def cmd_check(a: argparse.Namespace) -> int:
    root = repo_root()
    hdir = root / '.handoff'
    paths = [Path(p) for p in a.paths] or sorted(hdir.glob('*'))
    problems: list[str] = []
    warnings: list[str] = []
    mvhs: dict[str, dict | None] = {}
    for p in paths:
        if p.name.endswith('.mvh.json'):
            mvhs[p.name[:-len('.mvh.json')]] = check_mvh(p, problems)
    for p in paths:
        if p.suffix == '.md':
            slug = re.sub(r'-\d{8}$', '', p.stem)
            check_md(p, mvhs.get(slug), problems, warnings)
        if p.is_file():
            check_secrets(p, problems)
    if not a.paths:
        check_index(root, problems)
    for w in warnings:
        print(f'  ! {w}')
    for pr in problems:
        print(f'  ✗ {pr}')
    print(f'handoff check: {len(problems)} problem(s), {len(warnings)} warning(s)')
    return 1 if problems else 0


def fail(msg: str) -> int:
    print(f'handoff: {msg}', file=sys.stderr)
    return 2


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    n = sub.add_parser('new', help='draft MVH + narrative from git state')
    n.add_argument('slug')
    n.add_argument('--goal', required=True)
    n.add_argument('--title')
    n.add_argument('--next', help='the one concrete next action')
    n.add_argument('--priority', default='p1', choices=['p0', 'p1', 'p2', 'p3'])
    n.add_argument('--author', help='harness/model or person writing it, e.g. claude, codex, opencode/big-pickle')
    c = sub.add_parser('check', help='lint handoffs')
    c.add_argument('paths', nargs='*')
    sub.add_parser('index', help='add handoffs missing from active-tasks.json')
    a = ap.parse_args(argv)
    return {'new': cmd_new, 'check': cmd_check, 'index': cmd_index}[a.cmd](a)


if __name__ == '__main__':
    sys.exit(main())
