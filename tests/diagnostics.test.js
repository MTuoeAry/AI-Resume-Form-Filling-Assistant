const test = require("node:test");
const assert = require("node:assert/strict");

const diagnostics = require("../shared/diagnostics.js");
const { loadExtension } = require("./helpers/dom-extension");

test("formatFieldSummary keeps the most useful field metadata readable", () => {
  const summary = diagnostics.formatFieldSummary({
    fieldId: "f_12",
    kind: "text",
    label: "电子邮箱",
    name: "email",
    id: "user_email",
    placeholder: "请输入常用邮箱地址",
    context: "联系方式 请填写常用邮箱，后续通知会发到这里",
    options: [],
    sectionLabel: "基本信息",
    nearbyLabels: ["联系方式", "邮箱"],
  });

  assert.match(summary, /f_12/);
  assert.match(summary, /label="电子邮箱"/);
  assert.match(summary, /name="email"/);
  assert.match(summary, /placeholder="请输入常用邮箱地址"/);
  assert.match(summary, /section="基本信息"/);
  assert.match(summary, /nearby=\[联系方式 \| 邮箱\]/);
  assert.match(summary, /context="联系方式 请填写常用邮箱/);
});

test("formatMappingSummary shows source, reason, and transform", () => {
  const summary = diagnostics.formatMappingSummary(
    {
      fieldId: "f_3",
      label: "Available Start Date",
    },
    {
      resumePath: "jobPreferences.availableDate",
      reason: "字段明确询问可入职日期",
      transform: { type: "date_part", part: "year" },
    },
    { source: "ai" }
  );

  assert.match(summary, /\[映射:ai\]/);
  assert.match(summary, /f_3/);
  assert.match(summary, /jobPreferences.availableDate/);
  assert.match(summary, /transform=date_part\(year\)/);
  assert.match(summary, /reason="字段明确询问可入职日期"/);
});

test("formatFillSummary surfaces failure reason and final value", () => {
  const summary = diagnostics.formatFillSummary({
    field: {
      fieldId: "f_8",
      label: "性别",
    },
    mapping: {
      resumePath: "personal.gender",
    },
    rawValue: "男",
    finalValue: "男",
    fillResult: {
      filled: false,
      message: "未找到可匹配的下拉选项",
    },
  });

  assert.match(summary, /\[填充:失败\]/);
  assert.match(summary, /f_8/);
  assert.match(summary, /personal.gender/);
  assert.match(summary, /final="男"/);
  assert.match(summary, /detail="未找到可匹配的下拉选项"/);
});

test("diagnostic values for sensitive fields are redacted", () => {
  const summary = diagnostics.formatValueSummary(
    { fieldId: "f_9", label: "手机号" },
    { resumePath: "personal.phone" },
    "13800138000",
    "13800138000"
  );

  assert.match(summary, /raw="\[redacted\]"/);
  assert.match(summary, /final="\[redacted\]"/);
  assert.doesNotMatch(summary, /13800138000/);
});

test("field diagnostic events expose structure evidence without form values", () => {
  const event = diagnostics.createFieldEvent({
    fieldId: "f_10",
    kind: "text",
    label: "学校名称",
    sectionKey: "education",
    sectionLabel: "教育经历",
    sectionEvidence: "heading",
    sectionLocked: true,
    sectionItemIndex: 1,
    value: "Sensitive University",
  });

  assert.deepEqual(event, {
    type: "field",
    fieldId: "f_10",
    kind: "text",
    label: "学校名称",
    section: {
      key: "education",
      label: "教育经历",
      evidence: "heading",
      locked: true,
      itemIndex: 1,
    },
  });
  assert.doesNotMatch(JSON.stringify(event), /Sensitive University/);
});

test("decision diagnostic events retain source, conflict, and final status", () => {
  const event = diagnostics.createDecisionEvent({
    field: {
      fieldId: "f_11",
      label: "结束时间",
      sectionKey: "education",
      sectionItemIndex: 0,
    },
    mapping: {
      resumePath: "",
      reason: "multiple candidates",
      conflict: "start/end role ambiguous",
    },
    source: "cache",
    status: "ambiguous",
    detail: "未确定映射，已跳过",
  });

  assert.equal(event.type, "decision");
  assert.equal(event.fieldId, "f_11");
  assert.equal(event.source, "cache");
  assert.equal(event.status, "ambiguous");
  assert.equal(event.resumePath, "");
  assert.equal(event.reason, "multiple candidates");
  assert.equal(event.conflict, "start/end role ambiguous");
  assert.equal(event.detail, "未确定映射，已跳过");
});

test("production fill messages carry machine-readable field and decision events", async () => {
  const ext = loadExtension(
    '<section><h2>教育经历</h2><label for="school">学校名称</label><input id="school"></section>'
  );
  try {
    const profile = ext.window.ResumeSchema.normalizeResumeProfile({
      educations: [{ school: "Example University" }],
    });
    await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profile,
      fillMode: "overwrite",
      scope: "page",
    });

    const messages = ext.logs.filter((entry) => entry.type === "log");
    assert.ok(messages.some((entry) => entry.event?.type === "field"));
    assert.ok(
      messages.some(
        (entry) =>
          entry.event?.type === "decision" &&
          entry.event.status === "mapped" &&
          entry.event.resumePath === "educations.0.school"
      )
    );
  } finally {
    ext.close();
  }
});
