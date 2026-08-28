import { copyFile, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolDirectory, '../..');
const repositoryRoot = await realpath(projectRoot);
const sourcePath = 'docs/whitepaper/IROA_WHITEPAPER_KO.md';
const publicRoot = path.join(repositoryRoot, 'public/generated');
const ownedGeneratedDirectories = [
  path.join(publicRoot, 'docs/whitepaper'),
  path.join(publicRoot, 'docs/brand'),
];

function localImagePaths(markdown) {
  return [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)]
    .map((match) => decodeURIComponent(match[1].split(/[?#]/, 1)[0]))
    .filter((assetPath) => !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(assetPath));
}

async function resolveSourceAsset(rawPath) {
  const absolutePath = path.resolve(repositoryRoot, path.dirname(sourcePath), rawPath);
  const lexicalRelativePath = path.relative(repositoryRoot, absolutePath);
  if (lexicalRelativePath.startsWith('..') || path.isAbsolute(lexicalRelativePath)) {
    throw new Error(`whitepaper asset path escapes repository: ${rawPath}`);
  }
  try {
    await stat(absolutePath);
  } catch {
    throw new Error(`whitepaper asset is missing: ${rawPath}`);
  }
  const realAssetPath = await realpath(absolutePath);
  const relativePath = path.relative(repositoryRoot, realAssetPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`whitepaper asset realpath escapes repository: ${rawPath}`);
  }
  return { absolutePath: realAssetPath, relativePath };
}

async function cleanOwnedGeneratedDirectories() {
  for (const directory of ownedGeneratedDirectories) {
    const relativePath = path.relative(publicRoot, directory);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error(`refusing to remove non-owned generated path: ${directory}`);
    }
    await rm(directory, { recursive: true, force: true });
  }
}

const markdown = await readFile(path.join(repositoryRoot, sourcePath), 'utf8');
const assets = await Promise.all([...new Set(localImagePaths(markdown))].map(resolveSourceAsset));
await cleanOwnedGeneratedDirectories();

for (const asset of assets) {
  const destination = path.join(publicRoot, asset.relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(asset.absolutePath, destination);
}

console.log(`Synchronized ${assets.length} whitepaper assets into public/generated/`);
