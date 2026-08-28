import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from 'image-size';

const modulePath = fileURLToPath(import.meta.url).replace(/^\/@fs/, '');
export const REPOSITORY_ROOT = path.resolve(path.dirname(modulePath), '../../..');
export const WHITEPAPER_SOURCE_PATH = 'docs/whitepaper/IROA_WHITEPAPER_KO.md';

export interface LocalAsset {
  absolutePath: string;
  repositoryPath: string;
  publicUrl: string;
}

function stripUrlDecoration(value: string) {
  return decodeURIComponent(value.split(/[?#]/, 1)[0]);
}

export function isExternalUrl(value: string) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value);
}

export function resolveLocalAsset(rawPath: string, fromRepositoryPath = WHITEPAPER_SOURCE_PATH): LocalAsset {
  const cleanedPath = stripUrlDecoration(rawPath);
  if (!cleanedPath || isExternalUrl(cleanedPath)) {
    throw new Error(`expected a repository-local asset path, received "${rawPath}"`);
  }

  const repositoryRoot = realpathSync(REPOSITORY_ROOT);
  const absolutePath = path.resolve(repositoryRoot, path.dirname(fromRepositoryPath), cleanedPath);
  const lexicalRelativePath = path.relative(repositoryRoot, absolutePath);
  if (lexicalRelativePath.startsWith('..') || path.isAbsolute(lexicalRelativePath)) {
    throw new Error(`local asset path escapes repository "${rawPath}"`);
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`missing local image "${rawPath}"`);
  }

  const realAssetPath = realpathSync(absolutePath);
  const realRelativePath = path.relative(repositoryRoot, realAssetPath);
  if (realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
    throw new Error(`local asset realpath escapes repository "${rawPath}"`);
  }

  const repositoryPath = realRelativePath.split(path.sep).join('/');
  return {
    absolutePath: realAssetPath,
    repositoryPath,
    publicUrl: `/generated/${repositoryPath}`,
  };
}

export function imageAsset(rawPath: string, lazy: boolean) {
  const asset = resolveLocalAsset(rawPath);
  const dimensions = imageSize(readFileSync(asset.absolutePath));
  if (!dimensions.width || !dimensions.height) {
    throw new Error(`unable to determine image dimensions for "${rawPath}"`);
  }

  return {
    ...asset,
    width: dimensions.width,
    height: dimensions.height,
    lazy,
  };
}
