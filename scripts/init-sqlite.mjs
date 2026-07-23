import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databasePath = resolve(process.env.SQLITE_PATH || 'prisma/dev.db');
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Upstream" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL UNIQUE,
  "baseUrl" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'SUB2API',
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "enabled" INTEGER NOT NULL DEFAULT 1,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "creditUsdPerCny" REAL NOT NULL DEFAULT 1,
  "testModel" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "UpstreamKey" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "upstreamId" INTEGER NOT NULL REFERENCES "Upstream"("id") ON DELETE CASCADE,
  "group" TEXT NOT NULL DEFAULT 'default', "label" TEXT, "keyName" TEXT,
  "groupName" TEXT, "groupDescription" TEXT, "groupRateMultiplier" REAL,
  "remoteKeyId" TEXT, "metadataSyncedAt" DATETIME, "metadataError" TEXT,
  "apiKeyEnc" TEXT, "accessTokenEnc" TEXT, "userId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN', "lastBalance" REAL, "lastLatencyMs" INTEGER,
  "lastCollectedAt" DATETIME, "lastError" TEXT, "testModel" TEXT,
  "enabled" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("upstreamId", "group")
);
CREATE TABLE IF NOT EXISTS "Metric" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "upstreamId" INTEGER NOT NULL REFERENCES "Upstream"("id") ON DELETE CASCADE,
  "upstreamKeyId" INTEGER NOT NULL REFERENCES "UpstreamKey"("id") ON DELETE CASCADE,
  "balance" REAL, "latencyMs" INTEGER, "modelTestOk" INTEGER, "modelTestLatMs" INTEGER,
  "streamTps" REAL, "streamFirstLat" INTEGER, "streamTotalMs" INTEGER,
  "probeMode" TEXT NOT NULL DEFAULT 'LIGHT', "testModel" TEXT, "errorCode" TEXT,
  "success" INTEGER NOT NULL DEFAULT 0, "errorMessage" TEXT,
  "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "MonitoredModel" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "upstreamKeyId" INTEGER NOT NULL REFERENCES "UpstreamKey"("id") ON DELETE CASCADE,
  "modelName" TEXT NOT NULL, "officialInputPrice" REAL, "officialOutputPrice" REAL,
  "officialPriceSource" TEXT NOT NULL DEFAULT 'MANUAL', "enabled" INTEGER NOT NULL DEFAULT 1,
  "lastTestedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("upstreamKeyId", "modelName")
);
CREATE TABLE IF NOT EXISTS "PriceSnapshot" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "upstreamId" INTEGER NOT NULL REFERENCES "Upstream"("id") ON DELETE CASCADE,
  "upstreamKeyId" INTEGER REFERENCES "UpstreamKey"("id") ON DELETE SET NULL,
  "modelName" TEXT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'CNY',
  "inputPrice" REAL, "outputPrice" REAL, "cacheReadPrice" REAL, "cacheWritePrice" REAL,
  "fixedPrice" REAL, "source" TEXT NOT NULL DEFAULT 'MANUAL', "rawData" TEXT,
  "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "UsageSnapshot" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "upstreamId" INTEGER NOT NULL REFERENCES "Upstream"("id") ON DELETE CASCADE,
  "upstreamKeyId" INTEGER NOT NULL REFERENCES "UpstreamKey"("id") ON DELETE CASCADE,
  "modelName" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL, "outputTokens" INTEGER NOT NULL,
  "cacheReadTokens" INTEGER NOT NULL DEFAULT 0, "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
  "accountCost" REAL, "actualCost" REAL NOT NULL,
  "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Incident" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "upstreamId" INTEGER NOT NULL REFERENCES "Upstream"("id") ON DELETE CASCADE,
  "upstreamKeyId" INTEGER REFERENCES "UpstreamKey"("id") ON DELETE SET NULL,
  "type" TEXT NOT NULL, "severity" TEXT NOT NULL DEFAULT 'WARNING', "message" TEXT NOT NULL,
  "metricValue" REAL, "resolved" INTEGER NOT NULL DEFAULT 0, "resolvedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AlertRule" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL UNIQUE, "metric" TEXT NOT NULL,
  "operator" TEXT NOT NULL DEFAULT 'lt', "threshold" REAL NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'WARNING', "cooldownMin" INTEGER NOT NULL DEFAULT 30,
  "enabled" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AlertChannel" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL UNIQUE,
  "type" TEXT NOT NULL DEFAULT 'feishu', "config" TEXT NOT NULL,
  "enabled" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Setting" ("key" TEXT PRIMARY KEY, "value" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "User" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "username" TEXT NOT NULL UNIQUE, "password" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS "Upstream_enabled_status_idx" ON "Upstream"("enabled", "status");
CREATE INDEX IF NOT EXISTS "Upstream_type_idx" ON "Upstream"("type");
CREATE INDEX IF NOT EXISTS "UpstreamKey_upstream_enabled_status_idx" ON "UpstreamKey"("upstreamId", "enabled", "status");
CREATE INDEX IF NOT EXISTS "Metric_upstream_recorded_idx" ON "Metric"("upstreamId", "recordedAt");
CREATE INDEX IF NOT EXISTS "Metric_key_recorded_idx" ON "Metric"("upstreamKeyId", "recordedAt");
CREATE INDEX IF NOT EXISTS "Metric_recorded_idx" ON "Metric"("recordedAt");
CREATE INDEX IF NOT EXISTS "Price_upstream_model_recorded_idx" ON "PriceSnapshot"("upstreamId", "modelName", "recordedAt");
CREATE INDEX IF NOT EXISTS "Price_key_model_recorded_idx" ON "PriceSnapshot"("upstreamKeyId", "modelName", "recordedAt");
CREATE INDEX IF NOT EXISTS "Usage_key_model_recorded_idx" ON "UsageSnapshot"("upstreamKeyId", "modelName", "recordedAt");
CREATE INDEX IF NOT EXISTS "Usage_upstream_recorded_idx" ON "UsageSnapshot"("upstreamId", "recordedAt");
CREATE INDEX IF NOT EXISTS "MonitoredModel_key_enabled_tested_idx" ON "MonitoredModel"("upstreamKeyId", "enabled", "lastTestedAt");
CREATE INDEX IF NOT EXISTS "Incident_upstream_resolved_created_idx" ON "Incident"("upstreamId", "resolved", "createdAt");
CREATE INDEX IF NOT EXISTS "Incident_key_resolved_created_idx" ON "Incident"("upstreamKeyId", "resolved", "createdAt");
`);
db.close();
console.log(`SQLite initialized: ${databasePath}`);
