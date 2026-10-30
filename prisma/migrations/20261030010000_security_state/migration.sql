ALTER TABLE "Authorization"
    ADD COLUMN "legacyTokens" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Authorization"
SET "legacyTokens" = true;

CREATE TABLE "SessionRevocation"
(
    "tokenHash" TEXT         NOT NULL PRIMARY KEY,
    "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SessionRevocation_expiresAt_idx" ON "SessionRevocation" ("expiresAt");

CREATE TABLE "LoginRateLimit"
(
    "key"       TEXT         NOT NULL PRIMARY KEY,
    "attempts"  INTEGER      NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "LoginRateLimit_windowEnd_idx" ON "LoginRateLimit" ("windowEnd");
