const test = require("node:test");
const assert = require("node:assert/strict");
const { loadExtension } = require("./helpers/dom-extension");

test("target year/month components override AI transforms and full source dates", () => {
  const ext = loadExtension(`
    <label>年份<select id="year"><option>2024</option><option>2025</option><option>2026</option></select></label>
    <label>月份<select id="month">${Array.from({ length: 12 }, (_, index) => `<option>${index + 1}</option>`).join("")}</select></label>
  `);
  try {
    const scan = ext.api.scanFields();
    const yearRuntime = scan.runtime.find((runtime) => runtime.id === "year");
    const monthRuntime = scan.runtime.find((runtime) => runtime.id === "month");
    assert.equal(
      ext.api.deriveFillValue("2026-09-02", { type: "date_part", part: "day" }, yearRuntime),
      "2026"
    );
    assert.equal(
      ext.api.deriveFillValue("2026-09-02", { type: "none" }, monthRuntime),
      "09"
    );
  } finally {
    ext.close();
  }
});
