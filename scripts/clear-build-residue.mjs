import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function projectPath(...segments) {
  const target = path.resolve(projectRoot, ...segments);
  const relative = path.relative(projectRoot, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to clean path outside the project: ${target}`);
  }
  return target;
}

async function removeDirectory(...segments) {
  await rm(projectPath(...segments), { recursive: true, force: true });
}

async function removePrismaEngineTemps() {
  const pnpmDirectory = projectPath('node_modules', '.pnpm');
  const packageEntries = await readdir(pnpmDirectory, { withFileTypes: true }).catch(() => []);
  let removed = 0;

  for (const packageEntry of packageEntries) {
    if (!packageEntry.isDirectory() || !packageEntry.name.startsWith('@prisma+client@')) continue;
    const clientDirectory = projectPath(
      'node_modules',
      '.pnpm',
      packageEntry.name,
      'node_modules',
      '.prisma',
      'client'
    );
    const clientEntries = await readdir(clientDirectory, { withFileTypes: true }).catch(() => []);
    for (const clientEntry of clientEntries) {
      if (!clientEntry.isFile() || !/^query_engine.*\.tmp\d+$/.test(clientEntry.name)) continue;
      await rm(path.join(clientDirectory, clientEntry.name), { force: true });
      removed += 1;
    }
  }
  return removed;
}

await removeDirectory('.next', 'cache');
await removeDirectory('node_modules', '.cache', 'prisma');
const removedPrismaTemps = await removePrismaEngineTemps();

console.log(`Build residue cleared (Prisma temp engines: ${removedPrismaTemps}).`);
