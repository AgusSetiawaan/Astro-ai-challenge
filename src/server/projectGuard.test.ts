import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExecException } from 'node:child_process';
import {
  validatePath,
  validateProject,
  listBranches,
  currentBranch,
  defaultBranch,
  readApplicationId,
  type Exec,
} from './projectGuard';

let tmp: string;
beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'sg-pg-'));
});
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

function fakeExec(handlers: Record<string, { stdout?: string; stderr?: string; err?: Error }>): Exec {
  return (cmd, cb) => {
    const key = Object.keys(handlers).find((k) => cmd.includes(k));
    const r = key ? handlers[key] : { stdout: '', stderr: '', err: undefined };
    const err: ExecException | null = r.err ? Object.assign(r.err, { code: 1 }) as ExecException : null;
    cb(err, r.stdout ?? '', r.stderr ?? '');
  };
}

describe('validateProject', () => {
  it('rejects relative path', async () => {
    const r = await validateProject('relative/foo', { roots: [tmp] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/absolute/);
  });

  it('rejects path outside allowed roots', async () => {
    const r = await validateProject('/etc', { roots: [tmp] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/ALLOWED_PROJECT_ROOTS/);
  });

  it('rejects dir without .git', async () => {
    const r = await validateProject(tmp, { roots: [tmp] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/git repo/);
  });

  it('rejects when tracked files are modified', async () => {
    await mkdir(join(tmp, '.git'));
    const r = await validateProject(tmp, {
      roots: [tmp],
      execFn: fakeExec({ 'status --porcelain': { stdout: ' M src/foo.ts\n?? extra.md\n' } }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/uncommitted/);
  });

  it('tolerates untracked-only working tree', async () => {
    await mkdir(join(tmp, '.git'));
    const r = await validateProject(tmp, {
      roots: [tmp],
      execFn: fakeExec({ 'status --porcelain': { stdout: '?? a.md\n?? subdir/\n' } }),
    });
    expect(r.ok).toBe(true);
  });

  it('accepts a clean git project under root', async () => {
    await mkdir(join(tmp, '.git'));
    const r = await validateProject(tmp, {
      roots: [tmp],
      execFn: fakeExec({ 'status --porcelain': { stdout: '' } }),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe(tmp);
  });
});

describe('validatePath', () => {
  it('accepts a git repo even when status would show changes', async () => {
    await mkdir(join(tmp, '.git'));
    const r = await validatePath(tmp, { roots: [tmp] });
    expect(r.ok).toBe(true);
  });

  it('rejects non-git dir', async () => {
    const r = await validatePath(tmp, { roots: [tmp] });
    expect(r.ok).toBe(false);
  });
});

describe('branch helpers', () => {
  it('listBranches parses sorted local branches', async () => {
    const exec = fakeExec({
      'branch --list': { stdout: 'feature/x\nmain\nbugfix\n' },
    });
    const out = await listBranches(tmp, { execFn: exec });
    expect(out).toEqual(['bugfix', 'feature/x', 'main']);
  });

  it('currentBranch reads symbolic-ref HEAD', async () => {
    const exec = fakeExec({ 'symbolic-ref --short HEAD': { stdout: 'feature/foo\n' } });
    expect(await currentBranch(tmp, { execFn: exec })).toBe('feature/foo');
  });

  it('defaultBranch returns origin/HEAD when set', async () => {
    const exec = fakeExec({
      'symbolic-ref --short refs/remotes/origin/HEAD': { stdout: 'origin/main\n' },
    });
    expect(await defaultBranch(tmp, { execFn: exec })).toBe('main');
  });

  it('defaultBranch falls through to main when origin/HEAD missing', async () => {
    const exec = fakeExec({
      'symbolic-ref --short refs/remotes/origin/HEAD': { err: new Error('no upstream') },
      'branch --list': { stdout: 'feature\nmain\n' },
    });
    expect(await defaultBranch(tmp, { execFn: exec })).toBe('main');
  });

  it('defaultBranch falls through to master when only master exists', async () => {
    const exec = fakeExec({
      'symbolic-ref --short refs/remotes/origin/HEAD': { err: new Error('no upstream') },
      'branch --list': { stdout: 'master\nfeature\n' },
    });
    expect(await defaultBranch(tmp, { execFn: exec })).toBe('master');
  });

  it('defaultBranch falls back to current when no main/master/develop', async () => {
    const exec = fakeExec({
      'symbolic-ref --short refs/remotes/origin/HEAD': { err: new Error('x') },
      'branch --list': { stdout: 'feature/only\n' },
      'symbolic-ref --short HEAD': { stdout: 'feature/only\n' },
    });
    expect(await defaultBranch(tmp, { execFn: exec })).toBe('feature/only');
  });
});

describe('readApplicationId', () => {
  it('reads applicationId from build.gradle.kts', async () => {
    await mkdir(join(tmp, 'app'));
    await writeFile(
      join(tmp, 'app', 'build.gradle.kts'),
      `android {\n  defaultConfig {\n    applicationId = "com.acme.cool"\n  }\n}`
    );
    expect(await readApplicationId(tmp)).toBe('com.acme.cool');
  });

  it('falls back to namespace when applicationId missing', async () => {
    await mkdir(join(tmp, 'app'));
    await writeFile(
      join(tmp, 'app', 'build.gradle.kts'),
      `android {\n  namespace = "com.example.ns"\n}`
    );
    expect(await readApplicationId(tmp)).toBe('com.example.ns');
  });

  it('returns null when no app/build.gradle*', async () => {
    expect(await readApplicationId(tmp)).toBeNull();
  });
});
