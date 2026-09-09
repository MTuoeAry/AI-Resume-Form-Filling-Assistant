const test = require("node:test");
const assert = require("node:assert/strict");
const semantics = require("../shared/field-semantics.js");
const concepts = require("../shared/field-concepts.js");
const policy = require("../shared/mapping-policy.js");
const alignment = require("../shared/repeat-alignment.js");
const { loadExtension } = require("./helpers/dom-extension");

function validLanguagePaths() {
  return new Set([
    "languages.0.name",
    "languages.0.proficiency",
    "languages.0.testScore",
    "languages.0.examType",
    "languages.0.examLevel",
    "languages.0.scoreValue",
    "languages.0.cefrLevel",
    "languages.1.name",
    "skills.primarySkills",
    "skills.programmingLanguages",
  ]);
}

function languageField(label, extra = {}) {
  return {
    fieldId: extra.fieldId || "lang-1",
    sectionKey: "language",
    sectionItemIndex: 0,
    kind: "custom_picker",
    options: [],
    label,
    baseLabel: label,
    ...extra,
  };
}

test("T01 外语能力类型 maps to language name instead of skipping after rejecting skills", () => {
  const field = languageField("外语能力类型", { options: ["英语", "日语"] });
  assert.equal(
    semantics.resolvePreferredResumePath(field, "", validLanguagePaths()),
    "languages.0.name"
  );
  assert.equal(semantics.isResumePathCompatibleWithField(field, "skills.primarySkills"), false);
  assert.equal(semantics.isResumePathCompatibleWithField(field, "languages.0.name"), true);
});

test("T02 local AI and cache skill paths are rejected locked or unlocked", () => {
  for (const locked of [false, true]) {
    const field = languageField("外语能力类型", { sectionLocked: locked, options: ["英语", "日语"] });
    assert.equal(semantics.isResumePathCompatibleWithField(field, "skills.primarySkills"), false);
    assert.equal(policy.evaluateRequestedPath(field, "skills.primarySkills").ok, false);
    assert.equal(
      semantics.resolvePreferredResumePath(field, "skills.primarySkills", validLanguagePaths()),
      "languages.0.name"
    );
  }
});

test("T02 production normalizeMappings rejects cached or AI skill paths", () => {
  const ext = loadExtension(`
    <section>
      <h2>语言能力</h2>
      <label>外语能力类型
        <select id="lang-type"><option>英语</option><option>日语</option></select>
      </label>
    </section>
  `);
  try {
    const scan = ext.api.scanFields();
    const field = scan.fields.find((item) => item.label.includes("外语能力类型"));
    assert.ok(field, "language type field should be scanned");
    const normalized = ext.api.normalizeMappings(
      [{ fieldId: field.fieldId, resumePath: "skills.primarySkills" }],
      scan.fields,
      ext.window.ResumeSchema.normalizeResumeProfile({
        languages: [{ name: "英语" }],
        skills: { primarySkills: "视觉与视频算法：目标检测" },
      })
    );
    const mapping = normalized.find((item) => item.fieldId === field.fieldId);
    assert.equal(mapping.resumePath, "languages.0.name");
    assert.notEqual(mapping.rejectionCode, "incompatible_domain");
  } finally {
    ext.close();
  }
});

test("T03 英语能力等级 with proficiency options uses proficiency", () => {
  const field = languageField("英语能力等级", { options: ["基础", "熟练", "精通"] });
  assert.equal(
    semantics.resolvePreferredResumePath(field, "", validLanguagePaths()),
    "languages.0.proficiency"
  );
});

test("T04 英语能力等级 with CET options uses exam level", () => {
  const field = languageField("英语能力等级", { options: ["四级", "六级", "专四", "专八"] });
  assert.equal(
    semantics.resolvePreferredResumePath(field, "", validLanguagePaths()),
    "languages.0.examLevel"
  );
});

test("T05 CEFR options do not invent B2 from CET-6", () => {
  const field = languageField("英语能力等级", { options: ["A1", "A2", "B1", "B2", "C1", "C2"] });
  assert.equal(
    semantics.resolvePreferredResumePath(field, "", validLanguagePaths()),
    "languages.0.cefrLevel"
  );
  assert.equal(semantics.inferConcept(field).id, "language.cefrLevel");
});

test("T06 programming languages stay skills even beside a language heading", () => {
  const field = {
    sectionKey: "",
    label: "编程语言",
    baseLabel: "编程语言",
    nearbyLabels: ["语言"],
  };
  assert.equal(
    semantics.resolvePreferredResumePath(field, "", validLanguagePaths()),
    "skills.programmingLanguages"
  );
  assert.equal(semantics.isResumePathCompatibleWithField(field, "languages.0.name"), false);
});

test("T07 existing technical text does not change a foreign-language type concept", () => {
  const field = languageField("外语能力类型", {
    options: ["英语", "日语"],
    currentValue: "视觉与视频算法：目标检测",
  });
  assert.equal(semantics.inferConcept(field).id, "language.name");
});

test("T09 option loading empty and unavailable stay unmapped", () => {
  for (const optionState of ["loading", "empty", "unavailable"]) {
    const field = languageField("英语能力等级", { optionState, options: [] });
    assert.equal(semantics.resolvePreferredResumePath(field, "", validLanguagePaths()), "");
    assert.equal(concepts.inferConcept(field).status, "ambiguous");
  }
});

test("T11 language type without a language value still rejects skills", () => {
  const field = languageField("外语能力类型", { options: ["英语", "日语"] });
  assert.equal(semantics.isResumePathCompatibleWithField(field, "skills.primarySkills"), false);
  assert.equal(policy.evaluateRequestedPath(field, "skills.primarySkills").code, "incompatible_domain");
});

test("T12 a generic 类型 label stays unmapped", () => {
  const field = languageField("类型");
  assert.equal(semantics.resolvePreferredResumePath(field, "", validLanguagePaths()), "");
});

test("T13 extra empty award targets do not reuse the first source record", () => {
  const fields = Array.from({ length: 8 }, (_, index) => ({
    fieldId: `award-${index}`,
    sectionKey: "award",
    label: "奖项名称",
    sectionItemIndex: 0,
  }));
  alignment.assignFallbackRepeatItemIndexes(fields, { fieldSemantics: semantics });
  assert.deepEqual(fields.map((field) => field.sectionItemIndex), [0, 1, 2, 3, 4, 5, 6, 7]);

  const profile = {
    awards: [
      { name: "国家奖学金", date: "2026-09" },
      { name: "学业奖学金", date: "2024-09" },
    ],
  };
  const scan = {
    fields,
    runtime: fields.map((field) => ({ fieldId: field.fieldId, kind: "text", el: { value: "" } })),
  };
  alignment.alignIncrementalRepeatSourceIndexes(scan, profile, {
    fieldSemantics: semantics,
    fillMode: "overwrite",
    document: { body: { textContent: "" } },
  });
  const assigned = fields.map((field) => field.sectionItemIndex);
  assert.equal(assigned.filter((index) => index === 0).length, 1);
  assert.equal(assigned.filter((index) => index === 1).length, 1);
  assert.equal(assigned.slice(2).some((index) => index === 0 || index === 1), false);
});

test("T14 same-name awards with different dates align in reverse page order", () => {
  const fields = [
    { fieldId: "n0", sectionKey: "award", label: "奖项名称", sectionItemIndex: 0 },
    { fieldId: "d0", sectionKey: "award", label: "获奖时间", sectionItemIndex: 0 },
    { fieldId: "n1", sectionKey: "award", label: "奖项名称", sectionItemIndex: 1 },
    { fieldId: "d1", sectionKey: "award", label: "获奖时间", sectionItemIndex: 1 },
  ];
  const scan = {
    fields,
    runtime: [
      { fieldId: "n0", kind: "text", el: { value: "国家奖学金" } },
      { fieldId: "d0", kind: "text", el: { value: "2024-09" } },
      { fieldId: "n1", kind: "text", el: { value: "国家奖学金" } },
      { fieldId: "d1", kind: "text", el: { value: "2026-09" } },
    ],
  };
  alignment.alignIncrementalRepeatSourceIndexes(scan, {
    awards: [
      { name: "国家奖学金", date: "2026-09" },
      { name: "国家奖学金", date: "2024-09" },
    ],
  }, { fieldSemantics: semantics, fillMode: "overwrite" });
  assert.equal(fields[0].sectionItemIndex, 1);
  assert.equal(fields[1].sectionItemIndex, 1);
  assert.equal(fields[2].sectionItemIndex, 0);
  assert.equal(fields[3].sectionItemIndex, 0);
});

test("T15 selected third project still fills only the bound editor", async () => {
  const ext = loadExtension(`
    <section>
      <h2>项目经历</h2>
      <article>
        <label>项目名称<input id="p1"></label>
        <label>项目描述<textarea id="d1"></textarea></label>
      </article>
      <article>
        <label>项目名称<input id="p2" value="已有项目，请保留"></label>
        <label>项目描述<textarea id="d2">邻区描述</textarea></label>
      </article>
    </section>
  `);
  try {
    ext.window.document.querySelectorAll("input,textarea").forEach((node, index) => {
      node.getBoundingClientRect = () => ({
        left: index < 2 ? 0 : 240,
        right: index < 2 ? 100 : 340,
        top: 0,
        bottom: 30,
        width: 100,
        height: 30,
      });
    });
    const target = ext.api.bindRecordTarget({ left: -10, top: -10, right: 120, bottom: 80 });
    const result = await ext.request({
      action: "fillSelectedRecord",
      token: target.token,
      sectionKey: "projects",
      record: { name: "第三条项目", description: "第三条说明" },
    });
    assert.equal(result.success, true, result.message);
    assert.equal(ext.window.document.querySelector("#p1").value, "第三条项目");
    assert.equal(ext.window.document.querySelector("#d1").value, "第三条说明");
    assert.equal(ext.window.document.querySelector("#p2").value, "已有项目，请保留");
    assert.equal(ext.window.document.querySelector("#d2").value, "邻区描述");
  } finally {
    ext.close();
  }
});

test("T16 rebuilt target is rejected instead of filling a neighbor", async () => {
  const ext = loadExtension(`
    <section>
      <h2>项目经历</h2>
      <label>项目名称<input id="p1"></label>
      <label>项目名称<input id="p2" value="邻区"></label>
    </section>
  `);
  try {
    ext.window.document.querySelectorAll("input").forEach((node, index) => {
      node.getBoundingClientRect = () => ({
        left: index * 200, right: index * 200 + 100, top: 0, bottom: 30, width: 100, height: 30,
      });
    });
    const target = ext.api.bindRecordTarget({ left: -10, top: -10, right: 120, bottom: 40 });
    const first = ext.window.document.querySelector("#p1");
    first.replaceWith(ext.window.document.createElement("input"));
    const result = await ext.request({
      action: "fillSelectedRecord",
      token: target.token,
      sectionKey: "projects",
      record: { name: "第三条项目" },
    });
    assert.equal(ext.window.document.querySelector("#p2").value, "邻区");
    assert.ok(result.success === false || result.failedCount > 0 || result.filledCount === 0);
  } finally {
    ext.close();
  }
});

test("T20 AI paths outside concept candidates are dropped and local mapping remains", () => {
  const ext = loadExtension(`
    <section>
      <h2>语言能力</h2>
      <label>外语能力类型<select id="lang-type"><option>英语</option></select></label>
      <label>掌握程度<select id="level"><option>基础</option><option>熟练</option></select></label>
    </section>
  `);
  try {
    const scan = ext.api.scanFields();
    const normalized = ext.api.normalizeMappings(
      scan.fields.map((field) => ({ fieldId: field.fieldId, resumePath: "skills.primarySkills" })),
      scan.fields,
      ext.window.ResumeSchema.createEmptyResumeProfile()
    );
    const typeMapping = normalized.find((item) =>
      scan.fields.find((field) => field.fieldId === item.fieldId)?.label.includes("外语能力类型")
    );
    const levelMapping = normalized.find((item) =>
      scan.fields.find((field) => field.fieldId === item.fieldId)?.label.includes("掌握程度")
    );
    assert.equal(typeMapping.resumePath, "languages.0.name");
    assert.equal(levelMapping.resumePath, "languages.0.proficiency");
  } finally {
    ext.close();
  }
});

test("T21 old cache entries with a stale rule version are rejected", () => {
  const ext = loadExtension("<main></main>");
  try {
    const lookup = ext.api.describeMappingCacheLookup(
      {
        "example.com:abc": {
          ruleVersion: 0,
          mappings: [{ fieldId: "f1", resumePath: "skills.primarySkills" }],
        },
      },
      "example.com:abc"
    );
    assert.equal(lookup.hit, false);
    assert.match(lookup.reason, /规则版本已升级/);
  } finally {
    ext.close();
  }
});

test("T22 concept memory matches origin and template but not another form", () => {
  const entry = {
    origin: "https://jobs.example",
    templateKey: "form-a",
    label: "英语能力等级",
    optionDomain: "examLevel",
    conceptId: "language.examLevel",
    ruleVersion: 1,
  };
  assert.equal(
    policy.memoryMatches(entry, {
      origin: "https://jobs.example",
      templateKey: "form-a",
      label: "英语能力等级",
      optionDomain: "examLevel",
    }),
    true
  );
  assert.equal(
    policy.memoryMatches(entry, {
      origin: "https://jobs.example",
      templateKey: "form-b",
      label: "英语能力等级",
      optionDomain: "examLevel",
    }),
    false
  );
  const remembered = policy.applyMemoryToField(
    languageField("英语能力等级"),
    [entry],
    {
      origin: "https://jobs.example",
      templateKey: "form-a",
      label: "英语能力等级",
      optionDomain: "examLevel",
      ruleVersion: 1,
    }
  );
  assert.equal(remembered.rememberedConceptId, "language.examLevel");
  assert.equal(
    semantics.resolvePreferredResumePath(remembered, "", validLanguagePaths()),
    "languages.0.examLevel"
  );
});

test("ambiguous English level still exposes exam and proficiency candidates to AI", () => {
  const field = languageField("英语能力等级");
  assert.deepEqual(
    policy.candidateResumePaths(field, Array.from(validLanguagePaths())).sort(),
    ["languages.0.cefrLevel", "languages.0.examLevel", "languages.0.proficiency"]
  );
  assert.equal(policy.evaluateRequestedPath(field, "skills.primarySkills").ok, false);
  assert.equal(policy.evaluateRequestedPath(field, "languages.0.proficiency").ok, true);
});

test("concept mapping does not default a missing record index to source 0", () => {
  const field = languageField("外语能力类型", { sectionItemIndex: undefined, options: ["英语"] });
  delete field.sectionItemIndex;
  assert.equal(
    semantics.resolvePreferredResumePath(field, "", validLanguagePaths()),
    ""
  );
});
