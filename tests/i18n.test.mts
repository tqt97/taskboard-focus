import assert from "node:assert/strict";
import test from "node:test";
import {
  getUiCopy,
  intlLocale,
  normalizeLocale,
  supportedLocales,
} from "../lib/i18n/index.ts";

test("normalizes unsupported locale values to Vietnamese", () => {
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("fr"), "vi");
  assert.equal(normalizeLocale(null), "vi");
});

test("provides stable Intl locale mappings for supported languages", () => {
  assert.deepEqual(supportedLocales, ["vi", "en", "ja"]);
  assert.equal(intlLocale.en, "en-US");
  assert.equal(intlLocale.ja, "ja-JP");
  assert.equal(getUiCopy("en").status.done, "Done");
  assert.equal(getUiCopy("ja").due.today, "今日");
});
