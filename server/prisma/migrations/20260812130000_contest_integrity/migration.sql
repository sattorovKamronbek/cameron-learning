-- Server judge integrity workflow.  Prisma schema is the source of truth;
-- this migration is intentionally explicit for production deployments.

CREATE TYPE "ContestMode" AS ENUM ('CONTEST', 'GYM');
CREATE TYPE "CheatingCaseStatus" AS ENUM ('SUSPECTED', 'CONFIRMED', 'DISMISSED');
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

ALTER TABLE "User"
  ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cheatingStrikes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Contest"
  ADD COLUMN "mode" "ContestMode" NOT NULL DEFAULT 'CONTEST';

ALTER TABLE "Submission"
  ADD COLUMN "similarityFingerprint" TEXT;

CREATE TABLE "CheatingCase" (
  "id" TEXT NOT NULL,
  "contestId" TEXT,
  "userId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "matchedSubmissionId" TEXT,
  "similarityScore" DOUBLE PRECISION NOT NULL,
  "aiConfidence" DOUBLE PRECISION,
  "aiSummary" TEXT,
  "evidence" JSONB,
  "status" "CheatingCaseStatus" NOT NULL DEFAULT 'SUSPECTED',
  "appealDeadline" TIMESTAMP(3),
  "strikesApplied" BOOLEAN NOT NULL DEFAULT false,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheatingCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheatingAppeal" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheatingAppeal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CheatingCase_submissionId_key" ON "CheatingCase"("submissionId");
CREATE INDEX "CheatingCase_userId_status_createdAt_idx" ON "CheatingCase"("userId", "status", "createdAt");
CREATE INDEX "CheatingCase_contestId_status_idx" ON "CheatingCase"("contestId", "status");
CREATE UNIQUE INDEX "CheatingAppeal_caseId_key" ON "CheatingAppeal"("caseId");
CREATE INDEX "CheatingAppeal_userId_status_createdAt_idx" ON "CheatingAppeal"("userId", "status", "createdAt");

ALTER TABLE "CheatingCase" ADD CONSTRAINT "CheatingCase_contestId_fkey"
  FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheatingCase" ADD CONSTRAINT "CheatingCase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheatingCase" ADD CONSTRAINT "CheatingCase_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheatingCase" ADD CONSTRAINT "CheatingCase_matchedSubmissionId_fkey"
  FOREIGN KEY ("matchedSubmissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheatingCase" ADD CONSTRAINT "CheatingCase_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheatingAppeal" ADD CONSTRAINT "CheatingAppeal_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "CheatingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheatingAppeal" ADD CONSTRAINT "CheatingAppeal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheatingAppeal" ADD CONSTRAINT "CheatingAppeal_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
