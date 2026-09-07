const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");

function loadDateParsingHelpers() {
  const tokenStart = source.indexOf("function normalizeDatePanelToken(value) {");
  const tokenEnd = source.indexOf("async function clickPickerMonthForYear", tokenStart);
  const dateStart = source.indexOf("function parseDateParts(value) {");
  const dateEnd = source.indexOf("function setNativeValue(element, value)", dateStart);
  if (tokenStart < 0 || tokenEnd <= tokenStart || dateStart < 0 || dateEnd <= dateStart) {
    throw new Error("date parsing helpers not found");
  }

  const context = { module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(tokenStart, tokenEnd)}\n${source.slice(dateStart, dateEnd)}\n` +
      `module.exports = { parseDateParts, parsePickerMonthToken, getPickerMonthLabels };`,
    context
  );
  return context.module.exports;
}

test("date component parser accepts day, month, and Chinese date formats", () => {
  const helpers = loadDateParsingHelpers();
  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.parseDateParts("2026-09-02"))),
    { year: 2026, month: 9, day: 2 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.parseDateParts("2026/9"))),
    { year: 2026, month: 9, day: 0 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.parseDateParts("2026年9月2日"))),
    { year: 2026, month: 9, day: 2 }
  );
});

test("date component parser recognizes Chinese and English month labels", () => {
  const helpers = loadDateParsingHelpers();
  assert.equal(helpers.parsePickerMonthToken("9 月"), 9);
  assert.equal(helpers.parsePickerMonthToken("September"), 9);
  assert.equal(helpers.parsePickerMonthToken("Sep."), 9);
  assert.ok(Array.from(helpers.getPickerMonthLabels(9)).includes("9月"));
  assert.ok(Array.from(helpers.getPickerMonthLabels(9)).includes("September"));
});

test("date component navigation uses explicit year/month controls and ignores adjacent days", () => {
  assert.match(source, /findDateNavigationControl/);
  assert.match(source, /前\|上\|previous\|prev\|left/);
  assert.match(source, /prev-month\|next-month\|other-month/);
  assert.match(source, /clickDatePanelConfirmation/);
  assert.match(source, /inferVisibleDatePanelPrecision/);
  assert.match(source, /targetPrecision === "month"/);
  assert.match(source, /targetPrecision === "year"/);
  assert.match(source, /year\[-_ \]\?panel/);
  assert.match(source, /refreshRuntimeElement\(runtime\)/);
});
