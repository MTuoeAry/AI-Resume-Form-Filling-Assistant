const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Failed to locate snippet: ${startMarker}`);
  }
  return source.slice(start, end);
}

function loadHelpers() {
  const source = fs.readFileSync(
    path.join(__dirname, "../content.js"),
    "utf8"
  );

  const snippet = `
    ${extractBetween(
      source,
      "  function buildTextFallbackValues(runtime, desired) {",
      "  function scrollIntoView(el) {"
    )}
    ${extractBetween(
      source,
      "  function pickBestOption(options, desired) {",
      "  function matchesAnyCandidate(optionText, candidates) {"
    )}
    ${extractBetween(
      source,
      "  function getMatchScore(optionText, candidateText) {",
      "  function sleep(ms) {"
    )}
    ${extractBetween(
      source,
      "  function getCustomPickerDesiredCandidates(runtime, desired) {",
      "  async function fillCustomPicker(runtime, desired) {"
    )}
    ${extractBetween(
      source,
      "  function setNativeValue(element, value) {",
      "  function selectByText(selectEl, desired) {"
    )}
    ${extractBetween(
      source,
      "  function restoreFailedCustomPickerInput(input, previousValue) {",
      "  async function safeCheck(inputEl, checked) {"
    )}
    ${extractBetween(source, "  const MATCH_ALIAS_GROUPS = [", "  console.log(EXT_TAG,")}
    module.exports = {
      buildTextFallbackValues,
      pickBestOption,
      getCustomPickerDesiredCandidates,
      restoreFailedCustomPickerInput,
    };
  `;

  class MockInputElement {}
  Object.defineProperty(MockInputElement.prototype, "value", {
    configurable: true,
    get() {
      return this._value || "";
    },
    set(value) {
      this._value = String(value);
    },
  });
  class MockTextAreaElement extends MockInputElement {}
  class MockEvent {
    constructor(type) {
      this.type = type;
    }
  }
  const context = {
    module: { exports: {} },
    exports: {},
    HTMLInputElement: MockInputElement,
    HTMLTextAreaElement: MockTextAreaElement,
    Event: MockEvent,
    KeyboardEvent: MockEvent,
  };
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(snippet, context);
  return context.module.exports;
}

test("pickBestOption prefers full-time study mode over fuzzy sibling options", () => {
  const helpers = loadHelpers();
  const option = helpers.pickBestOption(
    [
      { label: "统招专升本", value: "upgrade" },
      { label: "全国普通高等院校全日制", value: "fulltime" },
      { label: "全国普通高等院校非全日制", value: "parttime" },
    ],
    "统招"
  );

  assert.equal(option?.value, "fulltime");
});

test("zero work experience selects the graduate option in recruiting pickers", () => {
  const helpers = loadHelpers();
  assert.deepEqual(
    JSON.parse(JSON.stringify(helpers.getCustomPickerDesiredCandidates(
      { label: "工作年限" },
      "0"
    ))),
    ["应届毕业生"]
  );
});

test("buildTextFallbackValues converts month salary ranges to numeric fallback", () => {
  const helpers = loadHelpers();
  const fallbacks = helpers.buildTextFallbackValues(
    {
      label: "期望月薪",
      context: "请输入期望月薪（元）",
    },
    "10K-15K/月"
  );

  assert.deepEqual(JSON.parse(JSON.stringify(fallbacks)), ["10000"]);
});

test("numeric date parts match select options with localized units", () => {
  const helpers = loadHelpers();
  assert.equal(
    helpers.pickBestOption(
      [
        { label: "8月", value: "8" },
        { label: "9月", value: "9" },
        { label: "10月", value: "10" },
      ],
      "09"
    )?.value,
    "9"
  );
});

test("failed searchable-picker input is rolled back instead of leaving a stray value", () => {
  const helpers = loadHelpers();
  const events = [];
  const input = {
    tagName: "input",
    _value: "罗敬",
    dispatchEvent(event) {
      events.push(event.type);
    },
    blur() {
      events.push("blur");
    },
  };
  Object.defineProperty(input, "value", {
    get() {
      return this._value;
    },
    set(value) {
      this._value = String(value);
    },
  });

  helpers.restoreFailedCustomPickerInput(input, "");

  assert.equal(input.value, "");
  assert.deepEqual(events, ["keydown", "input", "change", "blur"]);
});
