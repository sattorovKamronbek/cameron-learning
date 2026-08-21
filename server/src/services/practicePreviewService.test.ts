import assert from "node:assert/strict";
import test from "node:test";
import { PracticePreviewValidationError, validatePracticePreviewRequest } from "./practicePreviewService";

test("practice preview accepts only supported languages and public example payloads", () => {
  const request = validatePracticePreviewRequest({
    language: "python3",
    source: "print(sum(map(int, input().split())))",
    examples: [{ input: "1 2\n", output: "3\n" }],
  });
  assert.equal(request.config.sourceFile, "main.py");
  assert.deepEqual(request.examples, [{ input: "1 2\n", output: "3\n" }]);
});

test("practice preview rejects missing code and unsupported languages before Docker", () => {
  assert.throws(() => validatePracticePreviewRequest({ language: "javascript", source: "", examples: [] }), PracticePreviewValidationError);
  assert.throws(() => validatePracticePreviewRequest({ language: "javascript", source: "console.log(1)", examples: [{ input: "", output: "" }] }), PracticePreviewValidationError);
});
