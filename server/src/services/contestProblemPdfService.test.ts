import assert from "node:assert/strict";
import test from "node:test";
import {
  buildContestProblemHtml,
  extractPublicSamplesFromProblemContent,
  normalizeContestProblemPdfRequest,
  parseFormattedContestProblem,
  safePdfFilename,
} from "./contestProblemPdfService";

test("PDF builder preserves public sample whitespace in the deterministic template", () => {
  const request = normalizeContestProblemPdfRequest({
    problemContent: "Find the sum.",
    metadata: { title: "A. Sum" },
    options: {},
    samples: [{ input: "1  2\n", output: "3\n" }],
  });
  const formatted = parseFormattedContestProblem(JSON.stringify({ sections: [{ heading: "Statement", content: "Find the sum." }] }));
  const html = buildContestProblemHtml(request, formatted);
  assert.match(html, /1  2\n/);
  assert.match(html, /<pre>3\n<\/pre>/);
});

test("PDF builder rejects AI-created sample sections and sanitizes filenames", () => {
  assert.throws(() => parseFormattedContestProblem(JSON.stringify({ sections: [{ heading: "Examples", content: "changed" }] })), /modified one or more sample values/);
  assert.equal(safePdfFilename({ contestName: "C/2026", problemLetter: "A", title: "Yig‘indi" }), "C-2026-A-Yig-indi.pdf");
});

test("PDF builder extracts pasted public example blocks without changing their inner whitespace", () => {
  assert.deepEqual(extractPublicSamplesFromProblemContent("### Example 1\nInput\n```\n1  2\n```\nOutput\n```\n3\n```"), [{ input: "1  2", output: "3" }]);
});
