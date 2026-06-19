-- AlterTable
ALTER TABLE "Liability" ADD COLUMN "isOverdue" BOOLEAN;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT,
    "playerId" INTEGER NOT NULL,
    "entity" TEXT NOT NULL DEFAULT 'personal',
    "plaidAccountId" TEXT,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "officialName" TEXT,
    "type" TEXT,
    "subtype" TEXT,
    "mask" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "isMonitored" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hiddenFromDashboard" BOOLEAN NOT NULL DEFAULT false,
    "rail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Account_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("createdAt", "displayName", "entity", "id", "isActive", "isManual", "isMonitored", "itemId", "mask", "name", "officialName", "plaidAccountId", "playerId", "rail", "subtype", "type") SELECT "createdAt", "displayName", "entity", "id", "isActive", "isManual", "isMonitored", "itemId", "mask", "name", "officialName", "plaidAccountId", "playerId", "rail", "subtype", "type" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_plaidAccountId_key" ON "Account"("plaidAccountId");
CREATE INDEX "Account_playerId_entity_idx" ON "Account"("playerId", "entity");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
