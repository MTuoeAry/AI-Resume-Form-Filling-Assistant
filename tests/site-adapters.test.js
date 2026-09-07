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
  assert.ok(
    rules.find((rule) => rule.sectionKey === "internships").sectionTexts.includes("实践活动")
  );
  assert.ok(
    rules.find((rule) => rule.sectionKey === "awards").sectionTexts.includes("奖励荣誉")
  );
  assert.ok(
    rules.find((rule) => rule.sectionKey === "campusExperiences").sectionTexts.includes("在校职务")
  );
});

test("Beisen Zhiye forms activate the platform adapter", () => {
  const adapter = adapters.getActiveAdapter({
    hostname: "huawutang1.zhiye.com",
    pathname: "/form",
  });

  assert.equal(adapter.id, "beisen-zhiye-form");
  assert.match(adapter.repeatTriggerSelector, /span\[class\]/);
  assert.equal(adapter.customPickerInputSelector, ".phoenix-select__input");
  assert.ok(adapter.optionSelectors.includes(".phoenix-selectList__listItem"));
  assert.ok(adapter.repeatRules.some((rule) => rule.sectionKey === "workExperiences"));
});

test("Beisen iTalent white-label domains activate the same Phoenix adapter", () => {
  const adapter = adapters.getActiveAdapter({
    hostname: "cloud.italent.cn",
    pathname: "/PageHome/Index",
  });

  assert.equal(adapter.id, "beisen-zhiye-form");
  assert.equal(adapter.customPickerInputSelector, ".phoenix-select__input");
});
