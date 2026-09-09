const test = require("node:test");
const assert = require("node:assert/strict");
const { loadExtension } = require("./helpers/dom-extension");

test("normalizeSelectionRect creates a stable viewport rectangle", () => {
  const ext = loadExtension("<main></main>");
  try {
    const rect = JSON.parse(
      JSON.stringify(
        ext.api.normalizeSelectionRect({ x: 180, y: 140 }, { x: 20, y: 40 })
      )
    );

    assert.deepEqual(rect, {
      left: 20,
      top: 40,
      right: 180,
      bottom: 140,
      width: 160,
      height: 100,
    });
  } finally {
    ext.close();
  }
});

test("rectsIntersect treats overlapping rectangles as in-scope", () => {
  const ext = loadExtension("<main></main>");
  try {
    assert.equal(
      ext.api.rectsIntersect(
        { left: 0, top: 0, right: 100, bottom: 100 },
        { left: 80, top: 80, right: 140, bottom: 140 }
      ),
      true
    );
    assert.equal(
      ext.api.rectsIntersect(
        { left: 0, top: 0, right: 50, bottom: 50 },
        { left: 80, top: 80, right: 140, bottom: 140 }
      ),
      false
    );
  } finally {
    ext.close();
  }
});

test("hasExistingFieldValue detects filled controls for incremental mode", () => {
  const ext = loadExtension(`
    <input id="name" value="Alice">
    <input id="blank">
    <select id="empty-select"><option value="">请选择</option><option>A</option></select>
    <select id="filled-select"><option value="">请选择</option><option selected>A</option></select>
    <div contenteditable="true" id="note">已有内容</div>
    <span class="picker ihr_base_picker--selected" id="selected-picker"></span>
    <span class="picker" id="empty-picker"></span>
    <div class="ant-select ant-select-enabled" id="ant-picker"><span class="ant-select-selection-selected-value">硕士研究生</span></div>
    <label><input type="radio" name="gender" value="男">男</label>
    <label><input type="radio" name="gender" value="女" checked>女</label>
  `);
  try {
    const hasValue = ext.api.hasExistingFieldValue;
    const document = ext.window.document;

    assert.equal(hasValue({ kind: "text", el: document.getElementById("name") }), true);
    assert.equal(hasValue({ kind: "text", el: document.getElementById("blank") }), false);
    assert.equal(
      hasValue({
        kind: "select",
        el: document.getElementById("empty-select"),
      }),
      false
    );
    assert.equal(
      hasValue({
        kind: "select",
        el: document.getElementById("filled-select"),
      }),
      true
    );
    assert.equal(
      hasValue({
        kind: "radio_group",
        options: Array.from(document.querySelectorAll('input[name="gender"]')).map((el) => ({ el })),
      }),
      true
    );
    assert.equal(
      hasValue({
        kind: "contenteditable",
        el: document.getElementById("note"),
      }),
      true
    );
    assert.equal(
      hasValue({
        kind: "custom_picker",
        el: { value: "" },
        pickerRoot: document.getElementById("selected-picker"),
      }),
      true
    );
    assert.equal(
      hasValue({
        kind: "custom_picker",
        el: { value: "" },
        pickerRoot: document.getElementById("empty-picker"),
      }),
      false
    );
    assert.equal(
      hasValue({
        kind: "custom_picker",
        el: { value: "" },
        pickerRoot: document.getElementById("ant-picker"),
      }),
      true
    );
  } finally {
    ext.close();
  }
});

test("refreshRuntimeElement follows framework rerenders before incremental checks", () => {
  const ext = loadExtension('<input id="stable-field" value="already filled">');
  try {
    const runtime = {
      kind: "text",
      id: "stable-field",
      el: ext.window.document.createElement("input"),
    };
    ext.api.refreshRuntimeElement(runtime);
    assert.equal(runtime.el, ext.window.document.getElementById("stable-field"));
    assert.equal(ext.api.hasExistingFieldValue(runtime), true);
  } finally {
    ext.close();
  }
});

test("refreshRuntimeElement keeps a connected repeated control with a shared name", () => {
  const ext = loadExtension('<input name="companyName" value="第二条经历">');
  try {
    const secondRowControl = ext.window.document.querySelector("input");
    const runtime = {
      kind: "text",
      name: "companyName",
      el: secondRowControl,
    };
    ext.api.refreshRuntimeElement(runtime);
    assert.equal(runtime.el, secondRowControl);
  } finally {
    ext.close();
  }
});

test("overwrite checkbox filling clears options outside the desired set", async () => {
  const ext = loadExtension(`
    <label><input type="checkbox" id="keep" checked>保留</label>
    <label><input type="checkbox" id="clear" checked>清除</label>
  `);
  try {
    const first = ext.window.document.getElementById("keep");
    const second = ext.window.document.getElementById("clear");
    const result = await ext.api.fillOne(
      {
        kind: "checkbox_group",
        options: [
          { el: first, label: "保留" },
          { el: second, label: "清除" },
        ],
      },
      ["保留"]
    );

    assert.equal(result.filled, true);
    assert.equal(first.checked, true);
    assert.equal(second.checked, false);
  } finally {
    ext.close();
  }
});

test("a false current-position value unchecks the single present checkbox", async () => {
  const ext = loadExtension('<label>至今 <input type="checkbox" id="present" checked></label>');
  try {
    const present = ext.window.document.getElementById("present");
    const result = await ext.api.fillOne(
      {
        kind: "checkbox_group",
        label: "至今",
        options: [{ el: present, label: "至今" }],
      },
      "否"
    );

    assert.equal(result.filled, true);
    assert.equal(present.checked, false);
  } finally {
    ext.close();
  }
});

test("fillOne has a defensive no-overwrite guard in incremental mode", async () => {
  const ext = loadExtension('<input id="existing" value="existing user value">');
  try {
    const result = await ext.api.fillOne(
      { kind: "text", el: ext.window.document.getElementById("existing") },
      "replacement",
      { overwrite: false }
    );

    assert.equal(result.filled, false);
    assert.equal(result.skipped, true);
    assert.equal(result.message, "字段已有内容，增量模式下不覆盖");
  } finally {
    ext.close();
  }
});
