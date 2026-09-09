const test = require("node:test");
const assert = require("node:assert/strict");
const { loadExtension } = require("./helpers/dom-extension");

const row = (label, control) => `<dl><dt>${label}</dt><dd>${control}</dd></dl>`;

test("testApi exposes alignment helpers without slicing content.js", () => {
  const ext = loadExtension("<main></main>");
  try {
    assert.equal(typeof ext.api.alignIncrementalRepeatSourceIndexes, "function");
    assert.equal(typeof ext.api.inferRepeatItemIndexFromIdentifier, "function");
    assert.equal(typeof ext.api.assignFallbackRepeatItemIndexes, "function");
    assert.equal(typeof ext.api.prepareTextValueForRuntime, "function");
    assert.equal(typeof ext.api.deriveFillValue, "function");
    assert.equal(typeof ext.window.ResumeRepeatAlignment.alignIncrementalRepeatSourceIndexes, "function");
  } finally {
    ext.close();
  }
});

test("incremental blank rows use the first resume item not already rendered", () => {
  const ext = loadExtension(`
    <p>国家一等奖 国家二等奖</p>
    <section><h2>获奖经历</h2>${row("奖项名称", '<input id="name">')}${row("获奖时间", '<input id="date">')}</section>
  `);
  try {
    const scan = ext.api.scanFields();
    const profile = ext.window.ResumeSchema.normalizeResumeProfile({
      awards: [{ name: "国家一等奖" }, { name: "国家二等奖" }, { name: "省级一等奖" }],
    });
    ext.api.alignIncrementalRepeatSourceIndexes(scan, profile, { fillMode: "incremental" });
    assert.equal(scan.fields[0].sectionItemIndex, 2);
    assert.equal(scan.fields[1].sectionItemIndex, 2);
  } finally {
    ext.close();
  }
});

test("incremental editing aligns an existing row by its anchor value, not page order", () => {
  const ext = loadExtension(
    `<section><h2>项目经历</h2>${row("项目名称", '<input id="project" value="第二个项目">')}</section>`
  );
  try {
    const scan = ext.api.scanFields();
    const profile = ext.window.ResumeSchema.normalizeResumeProfile({
      projects: [{ name: "第一个项目" }, { name: "第二个项目" }],
    });
    ext.api.alignIncrementalRepeatSourceIndexes(scan, profile);
    assert.equal(scan.fields[0].sectionItemIndex, 1);
  } finally {
    ext.close();
  }
});

test("same-name records with different dates are not bound by substring matching", () => {
  const ext = loadExtension(`<section><h2>教育经历</h2>
    ${row("学校名称", '<input id="school" value="Example University">')}
    ${row("开始时间", '<input id="start" value="2024-09">')}
  </section>`);
  try {
    const scan = ext.api.scanFields();
    const profile = ext.window.ResumeSchema.normalizeResumeProfile({
      educations: [
        { school: "Example University", startDate: "2020-09" },
        { school: "Example University", startDate: "2024-09" },
      ],
    });
    ext.api.alignIncrementalRepeatSourceIndexes(scan, profile);
    assert.equal(scan.fields.find((field) => field.id === "school").sectionItemIndex, 1);
    assert.equal(scan.fields.find((field) => field.id === "start").sectionItemIndex, 1);
  } finally {
    ext.close();
  }
});

test("tied same-name records without extra anchors are skipped instead of guessed", () => {
  const ext = loadExtension(`<section><h2>教育经历</h2>
    ${row("学校名称", '<input id="school0" value="Other University">')}
    ${row("学校名称", '<input id="school1" value="Example University">')}
  </section>`);
  try {
    const scan = ext.api.scanFields();
    const school1 = scan.fields.find((field) => field.id === "school1");
    const previous = school1.sectionItemIndex;
    const profile = ext.window.ResumeSchema.normalizeResumeProfile({
      educations: [
        { school: "Example University", startDate: "2020-09" },
        { school: "Example University", startDate: "2024-09" },
      ],
    });
    ext.api.alignIncrementalRepeatSourceIndexes(scan, profile);
    assert.equal(school1.sectionItemIndex, previous);
  } finally {
    ext.close();
  }
});

test("overwrite mode keeps blank page order instead of consuming leftover resume items", () => {
  const ext = loadExtension(`<p>Example University</p><section><h2>教育经历</h2>
    <article class="card">${row("学校名称", '<input id="school0">')}</article>
    <article class="card">${row("学校名称", '<input id="school1">')}</article>
  </section>`);
  try {
    const scan = ext.api.scanFields();
    const profile = ext.window.ResumeSchema.normalizeResumeProfile({
      educations: [{ school: "First University" }, { school: "Second University" }],
    });
    ext.api.alignIncrementalRepeatSourceIndexes(scan, profile, { fillMode: "overwrite" });
    assert.equal(scan.fields.find((field) => field.id === "school0").sectionItemIndex, 0);
    assert.equal(scan.fields.find((field) => field.id === "school1").sectionItemIndex, 1);
  } finally {
    ext.close();
  }
});
