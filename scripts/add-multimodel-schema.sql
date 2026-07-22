ALTER TABLE "Upstream" ADD COLUMN "creditUsdPerCny" REAL NOT NULL DEFAULT 1;

CREATE TABLE "MonitoredModel" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "upstreamKeyId" INTEGER NOT NULL,
  "modelName" TEXT NOT NULL,
  "officialInputPrice" REAL,
  "officialOutputPrice" REAL,
  "officialPriceSource" TEXT NOT NULL DEFAULT 'MANUAL',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastTestedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MonitoredModel_upstreamKeyId_fkey"
    FOREIGN KEY ("upstreamKeyId") REFERENCES "UpstreamKey" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MonitoredModel_upstreamKeyId_modelName_key"
  ON "MonitoredModel"("upstreamKeyId", "modelName");
CREATE INDEX "MonitoredModel_upstreamKeyId_enabled_lastTestedAt_idx"
  ON "MonitoredModel"("upstreamKeyId", "enabled", "lastTestedAt");
