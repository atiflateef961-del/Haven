import assert from "node:assert/strict";
import test from "node:test";
import { apiBaseUrl } from "./api-url.mjs";

test("uses the frontend origin for browser API requests", () => {
  assert.equal(apiBaseUrl, "");
});
