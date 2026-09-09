const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pageStructure = require("../shared/page-structure.js");

function createNode(parentElement = null) {
  const node = { parentElement, children: [] };
  if (parentElement) parentElement.children.push(node);
  node.contains = (candidate) =>
    node === candidate || node.children.some((child) => child.contains(candidate));
  return node;
}

test("segmented forms scan from their lowest shared container", () => {
  const page = createNode();
  const resume = createNode(page);
  const personalForm = createNode(resume);
  const projectForm = createNode(resume);
  const unrelatedForm = createNode(page);

  assert.equal(
    pageStructure.findLowestCommonAncestor([personalForm, projectForm]),
    resume
  );
  assert.equal(
    pageStructure.findLowestCommonAncestor([personalForm, unrelatedForm]),
    page
  );
});

test("zero successful writes are not reported as success when writes failed", () => {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  assert.match(source, /attemptedCount > 0\s*\? "failed"/);
  assert.match(source, /success: outcome !== "failed"/);
});
