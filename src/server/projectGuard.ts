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

export async function validateProject(path: string, opts: GuardOpts = {}): Promise<ValidateResult> {
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
  try {
    const { stdout } = await run(`git -C ${quote(abs)} status --porcelain`, opts.execFn);
    if (stdout.trim().length > 0) {
      return {
        ok: false,
        reason: `working tree is dirty — commit, stash, or discard before fix mode:\n${stdout.trim().split('\n').slice(0, 10).join('\n')}`,
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
