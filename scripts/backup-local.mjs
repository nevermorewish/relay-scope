import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env.local');
const backupRoot = path.join(projectRoot, 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const targetDirectory = path.join(backupRoot, timestamp);
const targetDatabase = path.join(targetDirectory, 'dev.db');

try {
  const envText = await readFile(envPath, 'utf8');
  loadEnvironment(envText);
  const databasePath = resolveDatabasePath(process.env.DATABASE_URL);
  await stat(databasePath);

  await mkdir(targetDirectory, { recursive: false });
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const sqliteTarget = targetDatabase.replace(/\\/g, '/').replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${sqliteTarget}'`);
  } finally {
    await prisma.$disconnect();
  }

  await copyFile(envPath, path.join(targetDirectory, '.env.local'));
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
  await writeFile(
    path.join(targetDirectory, 'manifest.json'),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      app: packageJson.name,
      version: packageJson.version,
      files: ['dev.db', '.env.local'],
      sensitive: true,
    }, null, 2) + '\n',
    'utf8',
  );

  console.log(`Backup created: ${path.relative(projectRoot, targetDirectory)}`);
  console.log('Contains encrypted credentials and .env.local; keep this directory private.');
} catch (error) {
  await rm(targetDirectory, { recursive: true, force: true }).catch(() => undefined);
  console.error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

function loadEnvironment(text) {
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

function resolveDatabasePath(databaseUrl) {
  if (!databaseUrl?.startsWith('file:')) {
    throw new Error('DATABASE_URL must use the local SQLite file: protocol');
  }
  const value = databaseUrl.slice('file:'.length).split('?')[0];
  if (!value) throw new Error('DATABASE_URL does not contain a database path');
  return path.isAbsolute(value)
    ? path.normalize(value)
    : path.resolve(projectRoot, 'prisma', value);
}
