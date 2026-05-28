#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));

const databaseName = process.env.CARGOBIT_LOCAL_DB || 'cargobit_dev';
const databaseUser = process.env.CARGOBIT_LOCAL_DB_USER || os.userInfo().username;
const databaseHost = process.env.CARGOBIT_LOCAL_DB_HOST || 'localhost';
const databasePort = process.env.CARGOBIT_LOCAL_DB_PORT || '5432';
const schema = process.env.CARGOBIT_LOCAL_DB_SCHEMA || 'public';
const databaseUrl = buildDatabaseUrl({
  user: databaseUser,
  host: databaseHost,
  port: databasePort,
  database: databaseName,
  schema,
});

main();

function main() {
  assertSafeDatabaseName(databaseName);
  ensurePostgresDatabase();

  if (args.has('--write-env')) {
    upsertEnvValue('DATABASE_URL', databaseUrl);
  }

  run('npx', ['prisma', 'db', 'push'], { DATABASE_URL: databaseUrl });
  run('node', ['scripts/seed-dispute-preview.mjs'], { DATABASE_URL: databaseUrl });

  console.log('\nLocal CargoBit PostgreSQL is ready.');
  console.log(`Database: ${databaseName}`);
  console.log('Preview dispute: http://localhost:3001/admin/disputes/dispute_1');
}

function ensurePostgresDatabase() {
  const exists = runPsqlScalar(
    'postgres',
    `SELECT 1 FROM pg_database WHERE datname = '${escapeSql(databaseName)}'`
  );

  if (exists.trim() === '1') {
    console.log(`PostgreSQL database "${databaseName}" already exists.`);
    return;
  }

  console.log(`Creating PostgreSQL database "${databaseName}"...`);
  run('createdb', ['-h', databaseHost, '-p', databasePort, '-U', databaseUser, databaseName]);
}

function runPsqlScalar(database, sql) {
  return execFileSync(
    'psql',
    ['-h', databaseHost, '-p', databasePort, '-U', databaseUser, '-d', database, '-tAc', sql],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

function run(command, commandArgs, extraEnv = {}) {
  execFileSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
}

function buildDatabaseUrl({ user, host, port, database, schema }) {
  const encodedUser = encodeURIComponent(user);
  return `postgresql://${encodedUser}@${host}:${port}/${database}?schema=${encodeURIComponent(schema)}`;
}

function upsertEnvValue(key, value) {
  const envPath = path.join(repoRoot, '.env');
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const nextLine = `${key}=${value}`;
  const next = existing.match(new RegExp(`^${key}=.*$`, 'm'))
    ? existing.replace(new RegExp(`^${key}=.*$`, 'm'), nextLine)
    : `${existing.trimEnd()}\n${nextLine}\n`;

  fs.writeFileSync(envPath, next.endsWith('\n') ? next : `${next}\n`);
  console.log(`Updated .env ${key} for local PostgreSQL.`);
}

function assertSafeDatabaseName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Unsafe database name: ${name}`);
  }
}

function escapeSql(value) {
  return value.replaceAll("'", "''");
}
