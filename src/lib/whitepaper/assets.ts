import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from 'image-size';
import {
  parseDestination,
} from '../../../tools/website/whitepaper-inventory.mjs';

const modulePath = fileURLToPath(import.meta.url).replace(/^\/@fs/, '');
export const REPOSITORY_ROOT = path.resolve(path.dirname(modulePath), '../../..');
export const WHITEPAPER_SOURCE_PATH = 'docs/whitepaper/IROA_WHITEPAPER_KO.md';

export interface LocalAsset {
  absolutePath: string;
  repositoryPath: string;
  publicUrl: string;
}

export interface WhitepaperInventoryEntry {
  kind: 'image' | 'link';
  raw: string;
  source: 'markdown' | 'html';
  alt?: string;
}

export interface WhitepaperInventory {
  images: WhitepaperInventoryEntry[];
  links: WhitepaperInventoryEntry[];
}

function inside(boundary: string, candidate: string) {
  const relative = path.relative(boundary, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function resolveLocalAsset(rawPath: string, fromRepositoryPath = WHITEPAPER_SOURCE_PATH, kind: 'image' | 'link' = 'image'): LocalAsset {
  const destination = parseDestination(rawPath);
  if (!destination.path || destination.isExternal) {
    throw new Error(`expected a repository-local ${kind} path, received "${rawPath}"`);
  }

  const repositoryRoot = realpathSync(REPOSITORY_ROOT);
  const relativeDestination = destination.isRootRelative ? destination.path.slice(1) : destination.path;
  const absolutePath = path.resolve(
    repositoryRoot,
    destination.isRootRelative ? '.' : path.dirname(fromRepositoryPath),
    relativeDestination,
  );
  if (!inside(repositoryRoot, absolutePath)) {
    throw new Error(`local asset path escapes repository "${rawPath}"`);
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`missing local ${kind} "${rawPath}"`);
  }

  const realAssetPath = realpathSync(absolutePath);
  if (!inside(repositoryRoot, realAssetPath)) {
    throw new Error(`local asset realpath escapes repository "${rawPath}"`);
  }

  const repositoryPath = path.relative(repositoryRoot, realAssetPath).split(path.sep).join('/');
  return {
    absolutePath: realAssetPath,
    repositoryPath,
    publicUrl: `/generated/${repositoryPath}`,
  };
}

export function resolveInventoryImages(inventory: WhitepaperInventory) {
  const images = new Map<string, LocalAsset>();
  for (const image of inventory.images) {
    const destination = parseDestination(image.raw);
    if (destination.isExternal) continue;
    images.set(image.raw, resolveLocalAsset(image.raw));
  }
  return images;
}

export function resolveRepositoryLink(entry: WhitepaperInventoryEntry) {
  return resolveLocalAsset(entry.raw, WHITEPAPER_SOURCE_PATH, 'link');
}

export function imageAsset(asset: LocalAsset, lazy: boolean) {
  const dimensions = imageSize(readFileSync(asset.absolutePath));
  if (!dimensions.width || !dimensions.height) {
    throw new Error(`unable to determine image dimensions for "${asset.repositoryPath}"`);
  }
  return { ...asset, width: dimensions.width, height: dimensions.height, lazy };
}
