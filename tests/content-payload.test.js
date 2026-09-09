const test = require("node:test");
const assert = require("node:assert/strict");
const { loadExtension } = require("./helpers/dom-extension");

test("buildFieldMappingPayload only includes resume fields with values", () => {
  const ext = loadExtension("<main></main>");
  try {
    const profile = ext.window.ResumeSchema.createEmptyResumeProfile();
    profile.personal.fullName = "张三";
    profile.personal.email = "zhangsan@example.com";

    const payload = ext.api.buildFieldMappingPayload(
      [{ fieldId: "f_1", label: "姓名", kind: "text" }],
      profile
    );
    const paths = JSON.parse(
      JSON.stringify(payload.resumeFields.map((field) => field.path).sort())
    );

    assert.equal(payload.resumeFields.length, 2);
    assert.deepEqual(paths, ["personal.email", "personal.fullName"]);
    assert.ok(payload.resumeFields.every((field) => field.hasValue === true));
  } finally {
    ext.close();
  }
});
