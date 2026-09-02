const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("resume editor and fill runner share the local attachment manager", () => {
  const editorHtml = fs.readFileSync(path.join(__dirname, "../resume-editor.html"), "utf8");
  const popupHtml = fs.readFileSync(path.join(__dirname, "../popup.html"), "utf8");
  const popupSource = fs.readFileSync(path.join(__dirname, "../popup.js"), "utf8");
  const contentSource = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");

  assert.match(editorHtml, /id="assetGrid"/);
  assert.match(editorHtml, /shared\/asset-storage\.js/);
  assert.match(popupHtml, /shared\/asset-storage\.js/);
  assert.match(popupSource, /getSerializableAssets\(\)/);
  assert.match(popupSource, /resumeAssets/);
  assert.match(contentSource, /new DataTransfer\(\)/);
  assert.match(contentSource, /findMatchingResumeAsset/);
});
