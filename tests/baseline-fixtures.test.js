const test = require("node:test");
const assert = require("node:assert/strict");

const { loadExtension } = require("./helpers/dom-extension");
const cases = require("./fixtures/baseline/cases.json");

for (const fixture of cases) {
  test(`baseline fixture: ${fixture.id}`, async () => {
    const ext = loadExtension(fixture.html, fixture.url);
    try {
      const profile = ext.window.ResumeSchema.normalizeResumeProfile(
        fixture.profile
      );
      const scan = ext.api.scanFields();
      if (fixture.fillMode === "incremental") {
        ext.api.alignIncrementalRepeatSourceIndexes(scan, profile);
      }
      const mappings = ext.api.normalizeMappings([], scan.fields, profile);

      for (const [id, expectedPath] of Object.entries(fixture.fieldPaths)) {
        const field = scan.fields.find((item) => item.id === id);
        assert.ok(field, `${fixture.id}: field ${id} was not discovered`);
        const mapping = mappings.find((item) => item.fieldId === field.fieldId);
        assert.equal(
          mapping?.resumePath,
          expectedPath,
          `${fixture.id}: ${id} mapped incorrectly`
        );
      }

      const result = await ext.request({
        action: "startFill",
        modelId: "",
        resumeProfile: profile,
        fillMode: fixture.fillMode || "overwrite",
        scope: "page",
      });

      assert.equal(result.success, true, JSON.stringify(result));
      assert.equal(result.failedCount, 0, JSON.stringify(result));
      for (const [id, expectedValue] of Object.entries(fixture.values)) {
        assert.equal(
          ext.window.document.getElementById(id)?.value,
          expectedValue,
          `${fixture.id}: ${id} final value`
        );
      }
    } finally {
      ext.close();
    }
  });
}
