import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, realpath, rm } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import type { Hex32 } from '@iroa/protocol';
import { canonicalJson, sha256Hex } from './canonical.js';

interface ScratchManifestEntry {
  readonly path: string;
  readonly size: number;
  readonly sha256: Hex32;
}

export interface ScratchDeletionEvidence {
  readonly storageScopeHash: Hex32;
  readonly fileCount: number;
  readonly totalBytes: number;
}

export interface ScratchRemovalAdapter {
  remove(directory: string): Promise<void>;
}

const defaultRemovalAdapter: ScratchRemovalAdapter = {
  remove: (directory) => rm(directory, { recursive: true, force: false }),
};

async function resolveScratchRoot(directory: string): Promise<string> {
  const requested = resolve(directory);
  const stat = await lstat(requested);
  if (stat.isSymbolicLink()) throw new Error('SCRATCH_ROOT_SYMLINK_FORBIDDEN');
  if (!stat.isDirectory()) throw new Error('SCRATCH_ROOT_NOT_DIRECTORY');
  const root = await realpath(requested);
  if (root !== requested) throw new Error('SCRATCH_ROOT_SYMLINK_FORBIDDEN');
  return root;
}

function assertWithinRoot(root: string, candidate: string): string {
  const rel = relative(root, candidate);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(root, rel) !== candidate) {
    throw new Error('SCRATCH_PATH_ESCAPE');
  }
  return rel.split(sep).join('/');
}

async function hashFile(path: string): Promise<Hex32> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return `0x${hash.digest('hex')}` as Hex32;
}

export async function hashScratchDirectory(directory: string): Promise<ScratchDeletionEvidence> {
  const root = await resolveScratchRoot(directory);
  const entries: ScratchManifestEntry[] = [];

  async function visit(current: string): Promise<void> {
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error('SCRATCH_SYMLINK_FORBIDDEN');
    if (stat.isFile()) {
      entries.push({
        path: assertWithinRoot(root, current),
        size: stat.size,
        sha256: await hashFile(current),
      });
      return;
    }
    if (!stat.isDirectory()) throw new Error('SCRATCH_ENTRY_TYPE_FORBIDDEN');
    const names = await readdir(current);
    names.sort((left, right) => left.localeCompare(right));
    for (const name of names) await visit(join(current, name));
  }

  await visit(root);
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return {
    storageScopeHash: sha256Hex(canonicalJson(entries)),
    fileCount: entries.length,
    totalBytes: entries.reduce((total, entry) => total + entry.size, 0),
  };
}

export async function hashAndDeleteScratchDirectory(
  directory: string,
  removalAdapter: ScratchRemovalAdapter = defaultRemovalAdapter,
): Promise<ScratchDeletionEvidence> {
  const root = await resolveScratchRoot(directory);
  const evidence = await hashScratchDirectory(root);
  await removalAdapter.remove(root);
  try {
    await lstat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return evidence;
    throw error;
  }
  throw new Error('SCRATCH_DELETION_NOT_CONFIRMED');
}
