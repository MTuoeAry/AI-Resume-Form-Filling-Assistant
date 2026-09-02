const test = require("node:test");
const assert = require("node:assert/strict");

const profileDocument = require("../shared/profile-document.js");

test("portable profile document has a versioned wrapper without unrelated secrets", () => {
  const text = profileDocument.serializeDocument({
    profile: { personal: { fullName: "张三" } },
    schemaVersion: 5,
    extensionVersion: "1.2.0",
  });
  const document = JSON.parse(text);

  assert.equal(document.format, "ai-resume-profile");
  assert.equal(document.documentVersion, 1);
  assert.equal(document.schemaVersion, 5);
  assert.equal(document.profile.personal.fullName, "张三");
  assert.equal("assets" in document, false);
  assert.equal("models" in document, false);
  assert.equal("apiKey" in document, false);
});

test("merge import overwrites non-empty values without erasing existing fields", () => {
  const current = {
    personal: { fullName: "旧姓名", email: "keep@example.com" },
    educations: [
      { school: "原学校", major: "计算机" },
      { school: "保留学校", major: "数学" },
    ],
  };
  const imported = {
    personal: { fullName: "新姓名", email: "" },
    educations: [{ school: "新学校", major: "" }],
  };

  const merged = profileDocument.mergeNonEmpty(current, imported);
  assert.equal(merged.personal.fullName, "新姓名");
  assert.equal(merged.personal.email, "keep@example.com");
  assert.equal(merged.educations[0].school, "新学校");
  assert.equal(merged.educations[0].major, "计算机");
  assert.equal(merged.educations[1].school, "保留学校");
});

test("parser accepts wrapped and raw profiles but rejects future schema versions", () => {
  const normalizeProfile = (profile) => ({ ...profile, normalized: true });
  const wrapped = profileDocument.parseDocument(
    JSON.stringify({
      format: "ai-resume-profile",
      documentVersion: 1,
      schemaVersion: 4,
      profile: { personal: { fullName: "李四" } },
    }),
    { currentSchemaVersion: 5, normalizeProfile }
  );
  assert.equal(wrapped.profile.normalized, true);
  assert.equal(wrapped.sourceSchemaVersion, 4);

  const raw = profileDocument.parseDocument(
    JSON.stringify({ personal: { fullName: "王五" } }),
    { currentSchemaVersion: 5 }
  );
  assert.equal(raw.wrapped, false);
  assert.equal(raw.profile.personal.fullName, "王五");

  assert.throws(
    () =>
      profileDocument.parseDocument(
        JSON.stringify({
          format: "ai-resume-profile",
          documentVersion: 1,
          schemaVersion: 6,
          profile: {},
        }),
        { currentSchemaVersion: 5 }
      ),
    /高于当前支持/
  );
});

test("portable profile filename uses a recognizable double suffix", () => {
  assert.equal(
    profileDocument.buildFileName(new Date(2026, 8, 2)),
    "ai-resume-profile-20260902.airesume.json"
  );
});
