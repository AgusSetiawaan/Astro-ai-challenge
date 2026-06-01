import { exec, type ExecException } from 'node:child_process';
import { stat, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

export type Exec = (
  cmd: string,
  cb: (err: ExecException | null, stdout: string, stderr: string) => void
) => void;

const defaultExec: Exec = (cmd, cb) => {
  exec(cmd, (err, stdout, stderr) => cb(err, String(stdout), String(stderr)));
};

function run(cmd: string, execFn: Exec = defaultExec): Promise<{ stdout: string; stderr: string }> {
  return new Promise((res, rej) => {
    execFn(cmd, (err, stdout, stderr) => {
      if (err) rej(Object.assign(new Error(stderr || err.message), { stdout, stderr, code: err.code }));
      else res({ stdout, stderr });
    });
  });
}

function quote(s: string): string {
  // Single-quote wrap; embedded single-quotes become '\''. Safe for sh.
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function allowedRoots(): string[] {
  const env = process.env.ALLOWED_PROJECT_ROOTS;
  if (env) return env.split(':').map((p) => resolve(p)).filter(Boolean);
  return [homedir()];
}

function isInsideRoot(abs: string, root: string): boolean {
  return abs === root || abs.startsWith(root + '/');
}

export type ValidateResult = { ok: true; path: string } | { ok: false; reason: string };

export interface GuardOpts {
  execFn?: Exec;
  /** Override allowed roots (tests). */
  roots?: string[];
}

/**
 * Light validation: absolute path, under ALLOWED_PROJECT_ROOTS, contains `.git/`.
 * Use for read-only ops (listing branches, reading applicationId). Does NOT
 * check working-tree cleanliness.
 */
export async function validatePath(path: string, opts: GuardOpts = {}): Promise<ValidateResult> {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    return { ok: false, reason: 'projectPath must be an absolute filesystem path' };
  }
  const abs = resolve(path);
  const roots = opts.roots ?? allowedRoots();
  if (!roots.some((r) => isInsideRoot(abs, r))) {
    return { ok: false, reason: `projectPath not under ALLOWED_PROJECT_ROOTS (${roots.join(', ')})` };
  }
  try {
    const s = await stat(join(abs, '.git'));
    if (!s.isDirectory() && !s.isFile()) return { ok: false, reason: '.git is neither a directory nor a file' };
  } catch {
    return { ok: false, reason: 'not a git repo (missing .git/)' };
  }
  return { ok: true, path: abs };
}

/**
 * Heavy validation: `validatePath` PLUS a working-tree cleanliness check.
 * Use before invoking Claude in fix mode.
 *
 * "Dirty" here means tracked-file modifications (M, A, D, R, C, U, T). Untracked
 * files (`??`) are tolerated because `git checkout <branch>` works in their
 * presence and they don't carry edits that could be lost.
 */
export async function validateProject(path: string, opts: GuardOpts = {}): Promise<ValidateResult> {
  const light = await validatePath(path, opts);
  if (!light.ok) return light;
  const abs = light.path;
  try {
    const { stdout } = await run(`git -C ${quote(abs)} status --porcelain`, opts.execFn);
    const lines = stdout.split('\n').filter((l) => l.length > 0);
    const trackedDirty = lines.filter((l) => !l.startsWith('?? '));
    if (trackedDirty.length > 0) {
      return {
        ok: false,
        reason:
          `working tree has uncommitted changes — commit, stash, or discard before fix mode:\n` +
          trackedDirty.slice(0, 10).join('\n'),
      };
    }
  } catch (e) {
    return { ok: false, reason: `git status failed: ${(e as Error).message}` };
  }
  return { ok: true, path: abs };
}

export async function listBranches(path: string, opts: GuardOpts = {}): Promise<string[]> {
  const { stdout } = await run(
    `git -C ${quote(path)} branch --list --format=%(refname:short)`,
    opts.execFn
  );
  return stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

export async function currentBranch(path: string, opts: GuardOpts = {}): Promise<string> {
  const { stdout } = await run(`git -C ${quote(path)} symbolic-ref --short HEAD`, opts.execFn);
  return stdout.trim();
}

export async function defaultBranch(path: string, opts: GuardOpts = {}): Promise<string | null> {
  try {
    const { stdout } = await run(
      `git -C ${quote(path)} symbolic-ref --short refs/remotes/origin/HEAD`,
      opts.execFn
    );
    return stdout.trim().replace(/^origin\//, '') || null;
  } catch {
    /* origin/HEAD not set; fall through */
  }
  const branches = await listBranches(path, opts);
  for (const cand of ['main', 'master', 'develop']) {
    if (branches.includes(cand)) return cand;
  }
  try {
    return await currentBranch(path, opts);
  } catch {
    return null;
  }
}

const APP_ID_RE = /\bapplicationId\s*[=:]?\s*["']([\w.]+)["']/;
const NAMESPACE_RE = /\bnamespace\s*[=:]?\s*["']([\w.]+)["']/;

export async function readApplicationId(path: string): Promise<string | null> {
  for (const rel of ['app/build.gradle.kts', 'app/build.gradle']) {
    try {
      const text = await readFile(join(path, rel), 'utf8');
      const m = APP_ID_RE.exec(text) ?? NAMESPACE_RE.exec(text);
      if (m) return m[1];
    } catch {
      /* file missing; try next */
    }
  }
  return null;
}
