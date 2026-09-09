const test = require("node:test");
const assert = require("node:assert/strict");
const { loadExtension } = require("./helpers/dom-extension");

test("impact factor fields accept compact numeric values only", () => {
  const ext = loadExtension("<main></main>");
  try {
    const normalize = ext.api.normalizeImpactFactorValue;
    assert.equal(normalize("6.7"), "6.7");
    assert.equal(normalize("IF: 6.7"), "6.7");
    assert.equal(normalize("影响因子 6.7"), "6.7");
    assert.equal(
      normalize("提出轻量级网络，在MSCOCO上达到72.4% AP，并降低计算量。"),
      ""
    );
  } finally {
    ext.close();
  }
});
