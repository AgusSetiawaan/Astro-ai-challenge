import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanProjects } from './scanProjects';

let tmp: string;
beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'sg-scan-'));
});
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

async function project(dir: string) {
  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, '.git'));
  await writeFile(join(dir, 'settings.gradle.kts'), 'rootProject.name = "x"');
}

describe('scanProjects', () => {
  it('finds projects under root', async () => {
    await project(join(tmp, 'AppOne'));
    await project(join(tmp, 'sub', 'AppTwo'));
    const out = await scanProjects({ roots: [tmp] });
    expect(out.sort()).toEqual([join(tmp, 'AppOne'), join(tmp, 'sub', 'AppTwo')].sort());
  });

  it('ignores dirs missing .git', async () => {
    const dir = join(tmp, 'NoGit');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'settings.gradle'), '');
    expect(await scanProjects({ roots: [tmp] })).toEqual([]);
  });

  it('ignores dirs missing settings.gradle', async () => {
    const dir = join(tmp, 'NoGradle');
    await mkdir(dir, { recursive: true });
    await mkdir(join(dir, '.git'));
    expect(await scanProjects({ roots: [tmp] })).toEqual([]);
  });

  it('does not recurse into a found project', async () => {
    await project(join(tmp, 'Outer'));
    // create a nested would-be project; should not be reported because
    // outer matched and we stop descending there.
    await project(join(tmp, 'Outer', 'Nested'));
    const out = await scanProjects({ roots: [tmp] });
    expect(out).toEqual([join(tmp, 'Outer')]);
  });

  it('honors maxDepth cap', async () => {
    await project(join(tmp, 'a', 'b', 'c', 'DeepApp'));
    const out = await scanProjects({ roots: [tmp], maxDepth: 2 });
    expect(out).toEqual([]);
    const outDeep = await scanProjects({ roots: [tmp], maxDepth: 4 });
    expect(outDeep).toEqual([join(tmp, 'a', 'b', 'c', 'DeepApp')]);
  });

  it('skips dotfiles and node_modules', async () => {
    await project(join(tmp, 'node_modules', 'fake'));
    await project(join(tmp, '.cache', 'fake'));
    await project(join(tmp, 'Real'));
    const out = await scanProjects({ roots: [tmp] });
    expect(out).toEqual([join(tmp, 'Real')]);
  });

  it('tolerates missing root', async () => {
    const out = await scanProjects({ roots: [join(tmp, 'does-not-exist')] });
    expect(out).toEqual([]);
  });
});
