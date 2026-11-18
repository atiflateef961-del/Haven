import assert from "node:assert/strict";
import test from "node:test";
import { displayCurrencyCode, formatMoney } from "./money.mjs";

test("maps USD presentation to PKR and keeps the amount in Pakistani grouping", () => {
  assert.equal(displayCurrencyCode("USD"), "PKR");
  assert.equal(formatMoney("1270000.00", "USD"), "PKR 12,70,000.00");
});

test("preserves other supplied currencies and handles a missing payment amount", () => {
  assert.equal(formatMoney(1250, "PKR"), "PKR 1,250.00");
  assert.equal(formatMoney(null, "PKR"), "PKR —");
});
