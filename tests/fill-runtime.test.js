const test = require("node:test");
const assert = require("node:assert/strict");

const fillRuntime = require("../shared/fill-runtime.js");

test("normalizeValueForRuntime converts readonly month picker values to YYYY-MM", () => {
  const runtime = {
    readOnly: true,
    inputType: "text",
    placeholder: "入学时间",
    label: "请填写入学时间",
    hasCalendarIcon: true,
    pickerPrecision: "month",
  };

  assert.equal(
    fillRuntime.normalizeValueForRuntime(runtime, "2025-12-01"),
    "2025-12"
  );
});

test("normalizeValueForRuntime also treats birth year-month fields as month precision", () => {
  const runtime = {
    readOnly: true,
    inputType: "text",
    placeholder: "选择日期",
    label: "姓名",
    context: "请填写出生年月",
    nearbyLabels: ["出生年月"],
    hasCalendarIcon: true,
    pickerPrecision: "month",
  };

  assert.equal(
    fillRuntime.normalizeValueForRuntime(runtime, "2005-06-23"),
    "2005-06"
  );
});

test("matchesWrittenValue accepts readonly month picker values with month prefix", () => {
  const runtime = {
    readOnly: true,
    inputType: "text",
    placeholder: "毕业时间",
    label: "请填写毕业时间",
    hasCalendarIcon: true,
  };

  assert.equal(
    fillRuntime.matchesWrittenValue(runtime, "2026-04-01", "2026-04"),
    true
  );
});

test("isReadonlyDateLikeRuntime rejects ordinary readonly text inputs without date hints", () => {
  const runtime = {
    readOnly: true,
    inputType: "text",
    placeholder: "请输入账号名称",
    label: "账号名称",
    hasCalendarIcon: false,
  };

  assert.equal(fillRuntime.isReadonlyDateLikeRuntime(runtime), false);
});

test("normalizeValueForRuntime preserves an exact day for day-capable start dates", () => {
  const runtime = {
    readOnly: true,
    inputType: "text",
    placeholder: "请选择开始日期",
    label: "开始日期",
    hasCalendarIcon: true,
    pickerPrecision: "day",
  };

  assert.equal(
    fillRuntime.normalizeValueForRuntime(runtime, "2026-07-23"),
    "2026-07-23"
  );
});

test("isDateLikeRuntime recognizes editable calendar-backed award dates", () => {
  const runtime = {
    readOnly: false,
    inputType: "text",
    placeholder: "请选择",
    label: "获奖时间",
    nearbyLabels: ["奖项名称"],
    hasCalendarIcon: true,
  };

  assert.equal(fillRuntime.isReadonlyDateLikeRuntime(runtime), false);
  assert.equal(fillRuntime.isDateLikeRuntime(runtime), true);
});

test("isDateLikeRuntime recognizes generic placeholders from semantic ids", () => {
  const runtime = {
    readOnly: false,
    inputType: "text",
    placeholder: "请选择",
    id: "basicInfo_recruitAwardList_0_awardTime",
    hasCalendarIcon: true,
  };

  assert.equal(fillRuntime.isDateLikeRuntime(runtime), true);
});

test("matchesWrittenValue compares common localized date formats", () => {
  const runtime = {
    inputType: "text",
    label: "Award date",
    hasCalendarIcon: true,
  };

  assert.equal(
    fillRuntime.matchesWrittenValue(runtime, "2026年9月2日", "2026-09-02"),
    true
  );
  assert.equal(
    fillRuntime.matchesWrittenValue(runtime, "09/02/2026", "2026-09-02"),
    true
  );
});
