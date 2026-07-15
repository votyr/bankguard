import test from "node:test";
import assert from "node:assert/strict";
import { deriveAmountCode, deriveRecipientInitials } from "../src/services/VisualPasswordService.js";

test("derives SRS amount verification codes", () => {
  assert.equal(deriveAmountCode(500000), "56");
  assert.equal(deriveAmountCode(2500), "24");
  assert.equal(deriveAmountCode(950), "93");
});
test("derives banking recipient initials", () => {
  assert.deepEqual(deriveRecipientInitials("Rahul Sharma"), ["R", "S"]);
});
