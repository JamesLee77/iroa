import { copyFile, lstat, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseDestination, parseWhitepaperInventory } from './whitepaper-inventory.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = path.resolve(toolDirectory, '../..');
const sourcePath = 'docs/whitepaper/IROA_WHITEPAPER_KO.md';

function inside(boundary, candidate) {
  const relative = path.relative(boundary, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function existingPathSafety(boundary, target) {
  if (!inside(boundary, target)) throw new Error(`generated destination escapes public boundary: ${target}`);
  const relative = path.relative(boundary, target);
  let current = boundary;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) throw new Error(`generated destination ancestor is a symlink: ${current}`);
      if (current !== target && !entry.isDirectory()) throw new Error(`generated destination ancestor is not a directory: ${current}`);
      const actual = await realpath(current);
      if (!inside(boundary, actual)) throw new Error(`generated destination realpath escapes public boundary: ${current}`);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
  }
}

async function resolveSourceAsset(rawPath, repositoryRoot) {
  const destination = parseDestination(rawPath);
  if (destination.isExternal || !destination.path) return null;
  const candidate = path.resolve(
    repositoryRoot,
    destination.isRootRelative ? '.' : path.dirname(sourcePath),
    destination.isRootRelative ? destination.path.slice(1) : destination.path,
  );
  if (!inside(repositoryRoot, candidate)) throw new Error(`whitepaper asset path escapes repository: ${rawPath}`);
  try {
    await stat(candidate);
  } catch {
    throw new Error(`whitepaper asset is missing: ${rawPath}`);
  }
  const actual = await realpath(candidate);
  if (!inside(repositoryRoot, actual)) throw new Error(`whitepaper asset realpath escapes repository: ${rawPath}`);
  return { absolutePath: actual, relativePath: path.relative(repositoryRoot, actual) };
}

async function makeDirectoriesSafely(publicRoot, destinationDirectory) {
  const relative = path.relative(publicRoot, destinationDirectory);
  let current = publicRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    await existingPathSafety(publicRoot, current);
    try {
      await mkdir(current);
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') throw error;
    }
    await existingPathSafety(publicRoot, current);
  }
}

export async function syncWhitepaperAssets({ projectRoot = defaultProjectRoot } = {}) {
  const repositoryRoot = await realpath(projectRoot);
  const publicRoot = path.join(repositoryRoot, 'public/generated');
  const ownedDirectories = [
    path.join(publicRoot, 'docs/whitepaper'),
    path.join(publicRoot, 'docs/brand'),
  ];
  const markdown = await readFile(path.join(repositoryRoot, sourcePath), 'utf8');
  const inventory = parseWhitepaperInventory(markdown);
  const assets = (await Promise.all(inventory.images.map((image) => resolveSourceAsset(image.raw, repositoryRoot))))
    .filter(Boolean);

  await existingPathSafety(repositoryRoot, publicRoot);
  await makeDirectoriesSafely(repositoryRoot, path.join(repositoryRoot, 'public'));
  await makeDirectoriesSafely(path.join(repositoryRoot, 'public'), publicRoot);
  for (const directory of ownedDirectories) {
    await existingPathSafety(publicRoot, directory);
    await rm(directory, { recursive: true, force: true });
  }

  for (const asset of assets) {
    const destination = path.join(publicRoot, asset.relativePath);
    if (!inside(publicRoot, destination)) throw new Error(`generated destination escapes public boundary: ${destination}`);
    await makeDirectoriesSafely(publicRoot, path.dirname(destination));
    await existingPathSafety(publicRoot, destination);
    await copyFile(asset.absolutePath, destination);
  }
  return { assetCount: assets.length, publicRoot };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await syncWhitepaperAssets();
  console.log(`Synchronized ${result.assetCount} whitepaper assets into public/generated/`);
}
