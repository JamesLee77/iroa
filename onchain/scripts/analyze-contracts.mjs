import { constants } from "node:fs";
import { access, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { getCacheDir } from "@nomicfoundation/hardhat-utils/global-dir";

const SOLC_VERSION = "0.8.24";
const projectRoot = process.cwd();
const compilerRoot = join(await getCacheDir(), "compilers-v3");
const entryPath = join(projectRoot, ".slither-entry.sol");

async function executableSolc() {
  const platforms = await readdir(compilerRoot, { withFileTypes: true });
  for (const platform of platforms) {
    if (!platform.isDirectory() || platform.name === "wasm") continue;
    const platformRoot = join(compilerRoot, platform.name);
    try {
      const list = JSON.parse(await readFile(join(platformRoot, "list.json"), "utf8"));
      const build = list.builds.find((candidate) => candidate.version === SOLC_VERSION);
      if (!build) continue;
      const compiler = join(platformRoot, build.path);
      await access(compiler, constants.X_OK);
      return compiler;
    } catch {
      // Continue to another native platform cache.
    }
  }
  throw new Error(`Hardhat native solc ${SOLC_VERSION} is not cached; run npm --workspace onchain run compile first`);
}

async function soliditySources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (relative(projectRoot, path).split(sep).join("/") === "contracts/test") continue;
      files.push(...await soliditySources(path));
    } else if (entry.isFile() && entry.name.endsWith(".sol")) {
      files.push(path);
    }
  }
  return files;
}

const compiler = await executableSolc();
const sources = (await soliditySources(join(projectRoot, "contracts"))).sort();
const imports = sources.map((source) => `import "./${relative(projectRoot, source).split(sep).join("/")}";`).join("\n");
await writeFile(entryPath, `// SPDX-License-Identifier: MIT\npragma solidity ${SOLC_VERSION};\n${imports}\n`, "utf8");

try {
  const result = spawnSync("slither", [
    entryPath,
    "--solc", compiler,
    "--solc-args", "--evm-version cancun",
    "--solc-remaps", "@openzeppelin/=../node_modules/@openzeppelin/",
    "--config-file", "slither.config.json",
    "--fail-high",
  ], { cwd: projectRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await unlink(entryPath).catch(() => undefined);
}
