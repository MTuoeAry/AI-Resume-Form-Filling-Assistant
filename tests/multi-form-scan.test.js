const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadLowestCommonAncestor() {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  const start = source.indexOf("function findLowestCommonAncestor(elements) {");
  const end = source.indexOf("function countControls(root) {", start);
  if (start < 0 || end <= start) throw new Error("common ancestor helper not found");
  const context = { module: { exports: {} }, exports: {} };
  vm.createContext(context);
  vm.runInContext(
    `${source.slice(start, end)}\nmodule.exports = findLowestCommonAncestor;`,
    context
  );
  return context.module.exports;
}

function createNode(parentElement = null) {
  const node = { parentElement, children: [] };
  if (parentElement) parentElement.children.push(node);
  node.contains = (candidate) =>
    node === candidate || node.children.some((child) => child.contains(candidate));
  return node;
}

test("segmented forms scan from their lowest shared container", () => {
  const findLowestCommonAncestor = loadLowestCommonAncestor();
  const page = createNode();
  const resume = createNode(page);
  const personalForm = createNode(resume);
  const projectForm = createNode(resume);
  const unrelatedForm = createNode(page);

  assert.equal(
    findLowestCommonAncestor([personalForm, projectForm]),
    resume
  );
  assert.equal(
    findLowestCommonAncestor([personalForm, unrelatedForm]),
    page
  );
});

test("zero successful writes are not reported as success when writes failed", () => {
  const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
  assert.match(source, /attemptedCount > 0\s*\? "failed"/);
  assert.match(source, /success: outcome !== "failed"/);
});
