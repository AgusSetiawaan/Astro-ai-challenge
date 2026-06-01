import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_ROOT_NAMES = ['AndroidStudioProjects', 'dev', 'src', 'code', 'Projects'];

export interface ScanOpts {
  /** Override roots (tests). Default: $HOME/<DEFAULT_ROOT_NAMES>. */
  roots?: string[];
  maxDepth?: number;
}

/**
 * Walks the configured roots looking for Android projects: directories
 * containing both `.git/` and one of `settings.gradle{.kts}`.
 * Does not recurse into projects once found. Skips hidden dirs and `node_modules`.
 */
export async function scanProjects(opts: ScanOpts = {}): Promise<string[]> {
  const home = homedir();
  const roots = opts.roots ?? DEFAULT_ROOT_NAMES.map((r) => join(home, r));
  const maxDepth = opts.maxDepth ?? 3;
  const found: string[] = [];
  for (const root of roots) {
    await walk(root, 0, maxDepth, found);
  }
  return Array.from(new Set(found)).sort();
}

async function walk(dir: string, depth: number, maxDepth: number, found: string[]): Promise<void> {
  if (depth > maxDepth) return;
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  if (await isProjectDir(dir)) {
    found.push(dir);
    return; // don't descend further into a project
  }
  if (depth === maxDepth) return;

  for (const e of entries) {
    if (e.startsWith('.') || e === 'node_modules') continue;
    const child = join(dir, e);
    if (await isDir(child)) await walk(child, depth + 1, maxDepth, found);
  }
}

async function isProjectDir(dir: string): Promise<boolean> {
  const [hasGit, gradleA, gradleB] = await Promise.all([
    isDir(join(dir, '.git')),
    fileExists(join(dir, 'settings.gradle')),
    fileExists(join(dir, 'settings.gradle.kts')),
  ]);
  return hasGit && (gradleA || gradleB);
}

async function isDir(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
