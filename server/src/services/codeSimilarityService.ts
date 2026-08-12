import crypto from "crypto";
import { prisma } from "../index";

const KEYWORDS = new Set([
  "alignas", "alignof", "and", "and_eq", "asm", "auto", "await", "break", "case", "catch", "char", "class", "const", "continue", "def", "default", "delete", "do", "double", "elif", "else", "enum", "except", "explicit", "export", "extends", "false", "final", "finally", "float", "for", "friend", "from", "if", "implements", "import", "in", "inline", "int", "interface", "lambda", "long", "namespace", "new", "not", "null", "operator", "or", "override", "package", "pass", "private", "protected", "public", "raise", "return", "short", "signed", "sizeof", "static", "strictfp", "struct", "super", "switch", "synchronized", "template", "this", "throw", "throws", "true", "try", "typedef", "typename", "union", "unsigned", "using", "var", "virtual", "void", "volatile", "while", "with", "yield",
]);

type SimilarityResult = {
  score: number;
  sharedShingles: number;
  leftShingles: number;
  rightShingles: number;
  fingerprint: string;
};

type AiReview = { confidence: number; summary: string } | null;

function stripCommentsAndLiterals(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)#.*$/gm, "$1 ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, " STR ");
}

export function normalizedTokens(source: string): string[] {
  const identifiers = new Map<string, string>();
  let identifierNumber = 0;
  return (stripCommentsAndLiterals(source).match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|==|!=|<=|>=|\+\+|--|&&|\|\||\S/g) || [])
    .map((token) => {
      const lower = token.toLowerCase();
      if (/^\d/.test(token)) return "NUM";
      if (!/^[A-Za-z_]/.test(token) || KEYWORDS.has(lower)) return lower;
      if (!identifiers.has(token)) identifiers.set(token, `id${++identifierNumber}`);
      return identifiers.get(token)!;
    });
}

function shingleSet(tokens: string[], width = 5): Set<string> {
  const set = new Set<string>();
  for (let index = 0; index <= tokens.length - width; index += 1) {
    set.add(crypto.createHash("sha256").update(tokens.slice(index, index + width).join("\u0001")).digest("base64url"));
  }
  return set;
}

export function compareSource(left: string, right: string): SimilarityResult {
  const leftTokens = normalizedTokens(left);
  const rightTokens = normalizedTokens(right);
  const leftSet = shingleSet(leftTokens);
  const rightSet = shingleSet(rightTokens);
  let shared = 0;
  for (const shingle of leftSet) if (rightSet.has(shingle)) shared += 1;
  const union = leftSet.size + rightSet.size - shared;
  const normalized = leftTokens.join(" ");
  return {
    score: union ? shared / union : 0,
    sharedShingles: shared,
    leftShingles: leftSet.size,
    rightShingles: rightSet.size,
    fingerprint: crypto.createHash("sha256").update(normalized).digest("hex"),
  };
}

async function reviewWithConfiguredAi(left: string, right: string, similarity: number): Promise<AiReview> {
  const endpoint = process.env.AI_SIMILARITY_REVIEW_URL;
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.AI_SIMILARITY_REVIEW_TOKEN ? { authorization: `Bearer ${process.env.AI_SIMILARITY_REVIEW_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        task: "Assess whether two competitive-programming submissions show non-trivial copied structure. Do not make a disciplinary decision.",
        structuralSimilarity: similarity,
        left,
        right,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const body = await response.json() as { confidence?: unknown; summary?: unknown };
    const confidence = Number(body.confidence);
    return {
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
      summary: typeof body.summary === "string" ? body.summary.slice(0, 2_000) : "Configured AI review returned no summary.",
    };
  } catch {
    // AI review is supplemental; a provider outage must not block judging.
    return null;
  }
}

/**
 * Creates a review case, never an automatic punishment.  An administrator
 * must confirm a case before a strike or ban can be applied.
 */
export async function scanSubmissionForSimilarity(submissionId: string): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, userId: true, contestId: true, problemId: true, source: true },
  });
  if (!submission || normalizedTokens(submission.source).length < 45) return;

  const candidates = await prisma.submission.findMany({
    where: {
      problemId: submission.problemId,
      userId: { not: submission.userId },
      verdict: "ACCEPTED",
      ...(submission.contestId ? { contestId: submission.contestId } : { contestId: null }),
    },
    select: { id: true, source: true },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  let best: { id: string; result: SimilarityResult; source: string } | null = null;
  for (const candidate of candidates) {
    const result = compareSource(submission.source, candidate.source);
    if (!best || result.score > best.result.score) best = { id: candidate.id, result, source: candidate.source };
  }
  if (!best || best.result.score < Number(process.env.CODE_SIMILARITY_THRESHOLD || "0.82")) {
    await prisma.submission.update({ where: { id: submission.id }, data: { similarityFingerprint: compareSource(submission.source, submission.source).fingerprint } });
    return;
  }

  const aiReview = await reviewWithConfiguredAi(submission.source, best.source, best.result.score);
  await prisma.$transaction(async (tx) => {
    await tx.submission.update({ where: { id: submission.id }, data: { similarityFingerprint: best!.result.fingerprint } });
    await tx.cheatingCase.upsert({
      where: { submissionId: submission.id },
      create: {
        contestId: submission.contestId,
        userId: submission.userId,
        submissionId: submission.id,
        matchedSubmissionId: best!.id,
        similarityScore: best!.result.score,
        aiConfidence: aiReview?.confidence,
        aiSummary: aiReview?.summary,
        evidence: {
          algorithm: "normalized-token-5gram-jaccard-v1",
          sharedShingles: best!.result.sharedShingles,
          leftShingles: best!.result.leftShingles,
          rightShingles: best!.result.rightShingles,
        },
      },
      update: {
        matchedSubmissionId: best!.id,
        similarityScore: best!.result.score,
        aiConfidence: aiReview?.confidence,
        aiSummary: aiReview?.summary,
      },
    });
  });
}
