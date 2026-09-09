const test = require("node:test");
const assert = require("node:assert/strict");
const { loadExtension } = require("./helpers/dom-extension");

const monthOptions = Array.from({ length: 12 }, (_, index) => `<option>${index + 1}</option>`).join("");

function wireDropdowns(window) {
  for (const root of window.document.querySelectorAll('[role="combobox"]')) {
    const list = root.querySelector("ul");
    const display = root.querySelector("span");
    root.addEventListener("click", (event) => {
      if (event.target.matches("li")) {
        if (display) display.textContent = event.target.textContent;
        const input = root.querySelector("input");
        if (input) input.value = event.target.textContent;
        root.dataset.value = event.target.textContent;
        if (list) list.hidden = true;
      } else if (list) {
        list.hidden = false;
      }
    });
  }
}

test("split native year/month dropdowns under 获奖时间 fill 2026-6-30 as parts", async () => {
  const ext = loadExtension(`
    <section>
      <h2>获奖经历</h2>
      <dl>
        <dt>获奖时间</dt>
        <dd>
          <select id="year">
            <option value="">年</option>
            <option>2024</option>
            <option>2025</option>
            <option>2026</option>
          </select>
          <select id="month">
            <option value="">月</option>
            ${monthOptions}
          </select>
        </dd>
      </dl>
      <dl><dt>奖项名称</dt><dd><input id="name"></dd></dl>
    </section>
  `);
  try {
    const scan = ext.api.scanFields();
    const yearField = scan.fields.find((field) => field.id === "year");
    const monthField = scan.fields.find((field) => field.id === "month");
    assert.equal(yearField.compositeRole, "year");
    assert.equal(monthField.compositeRole, "month");
    assert.match(yearField.label, /获奖时间/);

    const profile = ext.window.ResumeSchema.normalizeResumeProfile({
      awards: [{ date: "2026-6-30", name: "蓝桥杯" }],
    });
    const mappings = ext.api.normalizeMappings([], scan.fields, profile);
    const yearMapping = mappings.find((item) => item.fieldId === yearField.fieldId);
    const monthMapping = mappings.find((item) => item.fieldId === monthField.fieldId);
    assert.equal(yearMapping.resumePath, "awards.0.date");
    assert.equal(monthMapping.resumePath, "awards.0.date");

    const yearRuntime = scan.runtime.find((item) => item.id === "year");
    const monthRuntime = scan.runtime.find((item) => item.id === "month");
    assert.equal(ext.api.deriveFillValue("2026-06-30", { type: "none" }, yearRuntime), "2026");
    assert.equal(ext.api.deriveFillValue("2026-06-30", { type: "none" }, monthRuntime), "06");

    assert.equal((await ext.api.fillOne(yearRuntime, "2026", { overwrite: true })).filled, true);
    assert.equal((await ext.api.fillOne(monthRuntime, "06", { overwrite: true })).filled, true);
    assert.equal(ext.window.document.querySelector("#year").value, "2026");
    assert.equal(ext.window.document.querySelector("#month").value, "6");
  } finally {
    ext.close();
  }
});

test("split year/month comboboxes use placeholders to fill date parts", async () => {
  const ext = loadExtension(`
    <section>
      <h2>获奖经历</h2>
      <dl>
        <dt>获奖时间</dt>
        <dd>
          <div id="year" role="combobox" aria-haspopup="listbox">
            <span>年</span>
            <input placeholder="年">
            <ul hidden>
              <li>2025</li>
              <li>2026</li>
              <li>2027</li>
            </ul>
          </div>
          <div id="month" role="combobox" aria-haspopup="listbox">
            <span>月</span>
            <input placeholder="月">
            <ul hidden>
              ${Array.from({ length: 12 }, (_, index) => `<li>${index + 1}月</li>`).join("")}
            </ul>
          </div>
        </dd>
      </dl>
      <dl><dt>奖项名称</dt><dd><input id="name"></dd></dl>
    </section>
  `);
  try {
    wireDropdowns(ext.window);
    const scan = ext.api.scanFields();
    const yearField = scan.fields.find((field) => field.id === "year");
    const monthField = scan.fields.find((field) => field.id === "month");
    assert.equal(yearField.compositeRole, "year");
    assert.equal(monthField.compositeRole, "month");

    const yearRuntime = scan.runtime.find((item) => item.id === "year");
    const monthRuntime = scan.runtime.find((item) => item.id === "month");
    assert.equal(ext.api.hasExistingFieldValue(yearRuntime), false);
    assert.equal(ext.api.hasExistingFieldValue(monthRuntime), false);
    assert.equal(ext.api.deriveFillValue("2026-6-30", { type: "none" }, yearRuntime), "2026");
    assert.equal(ext.api.deriveFillValue("2026-6-30", { type: "none" }, monthRuntime), "06");

    assert.equal((await ext.api.fillOne(yearRuntime, "2026", { overwrite: true })).filled, true);
    assert.equal((await ext.api.fillOne(monthRuntime, "06", { overwrite: true })).filled, true);
    assert.equal(ext.window.document.querySelector("#year span").textContent, "2026");
    assert.equal(ext.window.document.querySelector("#month span").textContent, "6月");
  } finally {
    ext.close();
  }
});
