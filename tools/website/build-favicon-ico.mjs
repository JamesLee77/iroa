import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const iconDirectory = path.join(repositoryRoot, 'docs/brand/exports/icons');
const sizes = [16, 32, 48];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const frames = await Promise.all(sizes.map(async (size) => {
  const source = path.join(iconDirectory, `favicon-${size}.png`);
  const bytes = await readFile(source);
  if (!bytes.subarray(0, 8).equals(pngSignature)) throw new Error(`${source} is not a PNG`);
  if (bytes.readUInt32BE(16) !== size || bytes.readUInt32BE(20) !== size) {
    throw new Error(`${source} is not ${size}x${size}`);
  }
  return { bytes, size, source };
}));

const directorySize = 6 + (16 * frames.length);
const directory = Buffer.alloc(directorySize);
directory.writeUInt16LE(0, 0);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(frames.length, 4);

let imageOffset = directorySize;
frames.forEach(({ bytes, size }, index) => {
  const entryOffset = 6 + (16 * index);
  directory.writeUInt8(size, entryOffset);
  directory.writeUInt8(size, entryOffset + 1);
  directory.writeUInt8(0, entryOffset + 2);
  directory.writeUInt8(0, entryOffset + 3);
  directory.writeUInt16LE(1, entryOffset + 4);
  directory.writeUInt16LE(32, entryOffset + 6);
  directory.writeUInt32LE(bytes.length, entryOffset + 8);
  directory.writeUInt32LE(imageOffset, entryOffset + 12);
  imageOffset += bytes.length;
});

const output = path.join(repositoryRoot, 'public/favicon.ico');
await writeFile(output, Buffer.concat([directory, ...frames.map(({ bytes }) => bytes)]));
console.log(`Built ${path.relative(repositoryRoot, output)} from ${frames.map(({ source }) => path.relative(repositoryRoot, source)).join(', ')}`);
