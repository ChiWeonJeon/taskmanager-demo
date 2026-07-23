CREATE TABLE "ServerAnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventName" TEXT NOT NULL,
    "distinctId" TEXT NOT NULL,
    "properties" TEXT NOT NULL DEFAULT '{}',
    "appVersion" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ServerAnalyticsDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" DATETIME,
    "deliveredAt" DATETIME,
    "externalId" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServerAnalyticsDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ServerAnalyticsEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ServerAnalyticsEvent_eventName_occurredAt_idx" ON "ServerAnalyticsEvent"("eventName", "occurredAt");
CREATE INDEX "ServerAnalyticsEvent_createdAt_idx" ON "ServerAnalyticsEvent"("createdAt");
CREATE UNIQUE INDEX "ServerAnalyticsDelivery_eventId_destination_key" ON "ServerAnalyticsDelivery"("eventId", "destination");
CREATE INDEX "ServerAnalyticsDelivery_status_nextAttemptAt_idx" ON "ServerAnalyticsDelivery"("status", "nextAttemptAt");
CREATE INDEX "ServerAnalyticsDelivery_leaseUntil_idx" ON "ServerAnalyticsDelivery"("leaseUntil");
