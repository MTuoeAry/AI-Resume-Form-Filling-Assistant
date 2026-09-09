const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const fillRuntime = require("../shared/fill-runtime.js");

test("date component parser accepts day, month, and Chinese date formats", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(fillRuntime.parseDateParts("2026-09-02"))),
    { year: 2026, month: 9, day: 2 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(fillRuntime.parseDateParts("2026/9"))),
    { year: 2026, month: 9, day: 0 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(fillRuntime.parseDateParts("2026年9月2日"))),
    { year: 2026, month: 9, day: 2 }
  );
});

test("date component parser recognizes Chinese and English month labels", () => {
  assert.equal(fillRuntime.parsePickerMonthToken("9 月"), 9);
  assert.equal(fillRuntime.parsePickerMonthToken("September"), 9);
  assert.equal(fillRuntime.parsePickerMonthToken("Sep."), 9);
  assert.ok(Array.from(fillRuntime.getPickerMonthLabels(9)).includes("9月"));
  assert.ok(Array.from(fillRuntime.getPickerMonthLabels(9)).includes("September"));
});

test("date component navigation uses explicit year/month controls and ignores adjacent days", () => {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
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
