const test = require("node:test");
const assert = require("node:assert/strict");

const adapters = require("../shared/site-adapters.js");

test("Midea school resume activates a lightweight site adapter", () => {
  const adapter = adapters.getActiveAdapter({
    hostname: "careers.midea.com",
    pathname: "/schoolOut/resume",
  });

  assert.equal(adapter.id, "midea-school-resume");
  assert.match(adapter.customPickerInputSelector, /ihr_base_picker/);
  assert.match(adapter.customPickerRootSelector, /:not\(input\)/);
  assert.equal(adapter.repeatItemSelector, ".md-row.box-form");
  assert.ok(adapter.repeatRules.some((rule) => rule.sectionKey === "internships"));
  assert.ok(adapter.repeatRules.some((rule) => rule.sectionKey === "awards"));
});

test("unknown sites receive only conservative common repeat rules", () => {
  assert.equal(
    adapters.getActiveAdapter({ hostname: "example.com", pathname: "/apply" }),
    null
  );
  const rules = adapters.getRepeatRules({ hostname: "example.com", pathname: "/apply" });
  assert.ok(rules.length > 0);
  assert.equal(rules.some((rule) => rule.triggerTexts.includes("新增")), false);
  assert.ok(
    rules.find((rule) => rule.sectionKey === "projects").triggerTexts.includes("Add project")
  );
  assert.ok(
    rules.find((rule) => rule.sectionKey === "publications").rowLabels.includes("Paper title")
  );
  assert.ok(adapters.COMMON_REPEAT_ITEM_SELECTORS.includes("[data-item-index]"));
  assert.ok(adapters.COMMON_REPEAT_ITEM_SELECTORS.includes("fieldset"));
});
