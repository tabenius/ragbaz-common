#!/usr/bin/env python3
"""Run a GitHub Actions workflow's `run:` steps locally, in order, per job.

For when hosted CI is unavailable (quota, outage, offline). Not a full Actions
emulator: `uses:` steps are reported, not executed. Install the toolchains
they would set up (Python, Rust, Node, apt packages) yourself first.
Matrix jobs, `if:` conditions, services and secrets are not supported;
such steps are listed so a skipped check is visible, never silent.

  run-workflow-locally.py .github/workflows/ci.yml [--job NAME] [--keep-going]
  run-workflow-locally.py --list .github/workflows/ci.yml

Exit status is non-zero when any executed step failed.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit('PyYAML is required: python3 -m pip install pyyaml')

SKIP_PREFIXES = ('sudo apt-get', 'apt-get ')  # host package installs: done beforehand
# Steps that publish or deploy are never run unless --allow-publish is given.
PUBLISH_MARKERS = ('gh release', 'npm publish', 'cargo publish', 'wrangler deploy', 'wrangler publish',
                   'git push', 'docker push', 'cosign sign', 'twine upload')


def load(path: Path) -> dict:
    data = yaml.safe_load(path.read_text())
    if not isinstance(data, dict) or 'jobs' not in data:
        sys.exit(f'{path}: not a workflow with jobs')
    return data


def steps_of(job: dict):
    for i, step in enumerate(job.get('steps') or [], 1):
        name = step.get('name') or (step.get('run') or step.get('uses') or '').splitlines()[0][:70]
        yield i, name, step


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('workflow', type=Path)
    ap.add_argument('--job', action='append', help='only these job ids (repeatable)')
    ap.add_argument('--keep-going', action='store_true', help='continue after a failed step')
    ap.add_argument('--list', action='store_true', help='print the plan without running')
    ap.add_argument('--allow-publish', action='store_true', help='also run publish/deploy steps (default: refuse)')
    a = ap.parse_args()
    wf = load(a.workflow)
    root = a.workflow.resolve().parents[2] if a.workflow.resolve().parent.name == 'workflows' else Path.cwd()
    results = []
    for job_id, job in wf['jobs'].items():
        if a.job and job_id not in a.job:
            continue
        print(f'\n=== job {job_id}' + (f' ({job["name"]})' if job.get('name') else ''), flush=True)
        if job.get('strategy', {}).get('matrix'):
            print('  ! matrix not expanded; steps run once with the host toolchain')
        env = {**os.environ, **{k: str(v) for k, v in (wf.get('env') or {}).items()},
               **{k: str(v) for k, v in (job.get('env') or {}).items()}, 'CI': 'true'}
        env.setdefault('RUNNER_TEMP', tempfile.mkdtemp(prefix='runner-temp-'))
        if '${{' in str(job):
            print('  ! job uses ${{ }} expressions; they are passed through unexpanded')
        for i, name, step in steps_of(job):
            if 'uses' in step:
                print(f'  - [{i}] uses {step["uses"]}: not executed (provide this setup on the host)')
                results.append((job_id, name, 'skipped-uses'))
                continue
            cmd = step.get('run')
            if not cmd:
                continue
            if step.get('if'):
                print(f'  ! [{i}] {name}: has `if: {step["if"]}`; running unconditionally')
            if not a.allow_publish and any(m in cmd for m in PUBLISH_MARKERS):
                print(f'  - [{i}] {name}: publishes or deploys, refused (use --allow-publish)')
                results.append((job_id, name, 'refused-publish'))
                continue
            if cmd.strip().startswith(SKIP_PREFIXES):
                print(f'  - [{i}] {name}: host package install, skipped (install beforehand)')
                results.append((job_id, name, 'skipped-apt'))
                continue
            if a.list:
                print(f'  > [{i}] {name}')
                continue
            print(f'  > [{i}] {name}', flush=True)
            cwd = root / step.get('working-directory', job.get('defaults', {}).get('run', {}).get('working-directory', '.'))
            senv = {**env, **{k: str(v) for k, v in (step.get('env') or {}).items()}}
            t = time.time()
            rc = subprocess.run(['bash', '-eo', 'pipefail', '-c', cmd], cwd=cwd, env=senv).returncode
            status = 'ok' if rc == 0 else f'FAILED ({rc})'
            print(f'    {status} in {time.time() - t:.0f}s', flush=True)
            results.append((job_id, name, 'ok' if rc == 0 else 'failed'))
            if rc and not a.keep_going:
                break
        if any(r[2] == 'failed' for r in results) and not a.keep_going:
            break
    if not a.list:
        print('\n=== summary')
        for job_id, name, status in results:
            print(f'  {status:13} {job_id}: {name}')
    return 1 if any(r[2] == 'failed' for r in results) else 0


if __name__ == '__main__':
    sys.exit(main())
