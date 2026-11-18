import assert from "node:assert/strict";
import test from "node:test";
import { loginErrorMessage } from "./login-error.mjs";

test("keeps credential failures generic", () => {
  assert.equal(loginErrorMessage(401), "Sign-in failed. Check your email and password, then try again. For a password reset, contact your administrator.");
});

test("shows rate limiting without exposing account state", () => {
  assert.equal(loginErrorMessage(429), "Too many attempts. Please wait a minute and try again.");
});

test("reports server failures as service errors instead of bad credentials", () => {
  assert.equal(loginErrorMessage(500), "The sign-in service is unavailable. Please try again shortly.");
  assert.equal(loginErrorMessage(503), "The sign-in service is unavailable. Please try again shortly.");
});
