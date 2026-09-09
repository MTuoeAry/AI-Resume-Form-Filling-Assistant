const test = require("node:test");
const assert = require("node:assert/strict");

const flow = require("../shared/repeat-flow.js");

test("advance classifier never treats application submit as a record action", () => {
  assert.equal(flow.classifyAdvanceCandidate({ text: "提交申请", type: "submit", inSection: true }).kind, "forbidden");
  assert.equal(flow.classifyAdvanceCandidate({ text: "投递", inSection: true }).kind, "forbidden");
  assert.equal(flow.classifyAdvanceCandidate({ text: "提交", type: "submit", inSection: true }).kind, "forbidden");
  assert.equal(
    flow.classifyAdvanceCandidate({ text: "新增教育经历", type: "button", inSection: true }).kind,
    "add"
  );
  assert.equal(
    flow.classifyAdvanceCandidate({ text: "保存", type: "button", inSection: true, inEditor: true }).kind,
    "save"
  );
  assert.equal(
    flow.classifyAdvanceCandidate({ text: "新增教育经历", inSection: false }).kind,
    "out_of_scope"
  );
});

test("pickAdvanceAction requires the current editor to be filled before add", () => {
  const observation = {
    editors: [{ id: "editor", values: [], blank: true }],
    actions: [
      { kind: "add", enabled: true, id: "add" },
      { kind: "forbidden", text: "提交申请", id: "submit" },
    ],
  };
  assert.equal(
    flow.pickAdvanceAction(observation, { needsNewSlot: true, editorFilled: false }).kind,
    "unclear"
  );
  assert.equal(
    flow.pickAdvanceAction(observation, { needsNewSlot: true, editorFilled: true }).kind,
    "add"
  );
  assert.equal(flow.pickAdvanceAction(observation, { needsNewSlot: false }).kind, "none");
  assert.equal(
    flow.pickAdvanceAction(
      { editors: [], actions: [{ kind: "add", enabled: true, id: "add" }] },
      { needsNewSlot: true, editorFilled: false }
    ).kind,
    "add"
  );
});

test("save-then-add prefers save while add stays disabled", () => {
  const action = flow.pickAdvanceAction(
    {
      actions: [
        { kind: "save", enabled: true, id: "save" },
        { kind: "add", enabled: false, id: "add" },
      ],
    },
    { needsNewSlot: true, editorFilled: true }
  );
  assert.equal(action.kind, "save");
  assert.equal(action.id, "save");
});

test("verifyTransition accepts a reused editor that switches to a blank record", () => {
  const verified = flow.verifyTransition(
    { editors: [{ id: "one", values: ["exampleuniversity"] }], cards: [] },
    { editors: [{ id: "one", values: [] }], cards: [{ values: ["exampleuniversity"] }] },
    { kind: "save", entry: { primary: ["exampleuniversity"], secondary: [] } }
  );
  assert.equal(verified.ok, true);
});

test("verifyTransition does not treat an unchanged page as success", () => {
  const snapshot = { editors: [{ id: "one", values: ["a"] }], cards: [], validationMessages: [] };
  const verified = flow.verifyTransition(snapshot, snapshot, {
    kind: "add",
    entry: { primary: ["a"], secondary: [] },
  });
  assert.equal(verified.ok, false);
  assert.equal(verified.uncertain, true);
});

test("coordinator fills one record before requesting add", async () => {
  const events = [];
  let filled = [];
  let cards = [];
  let editorValues = [];
  const records = [
    { sourceIndex: 0, primary: ["firstu"], secondary: ["2020"] },
    { sourceIndex: 1, primary: ["secondu"], secondary: ["2024"] },
  ];
  const host = {
    observeSection() {
      return {
        editors: [{ id: "editor", values: editorValues, blank: editorValues.length === 0 }],
        cards: cards.map((values) => ({ values })),
        actions: [
          { kind: "add", enabled: editorValues.length > 0, id: "add" },
          { kind: "forbidden", id: "submit" },
        ],
        validationMessages: [],
      };
    },
    async fillCurrentRecord({ sourceIndex }) {
      events.push(`fill:${sourceIndex}`);
      editorValues = records[sourceIndex].primary;
      filled.push(sourceIndex);
      return { filled: true };
    },
    async validateCurrent() {
      return { ok: true };
    },
    async advance() {
      events.push("add");
      cards.push([...editorValues]);
      editorValues = [];
      return { ok: true };
    },
  };

  const result = await flow.createCoordinator(host).runSection({
    sectionKey: "education",
    sourceRecords: records,
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(events, ["fill:0", "add", "fill:1"]);
  assert.deepEqual(filled, [0, 1]);
});

test("coordinator does not retry add when timeout observation already shows the card", async () => {
  let clicks = 0;
  const entry = { sourceIndex: 0, primary: ["firstu"], secondary: [] };
  const next = { sourceIndex: 1, primary: ["secondu"], secondary: [] };
  let stage = "filled";
  const host = {
    observeSection() {
      if (stage === "filled") {
        return {
          editors: [{ id: "editor", values: ["firstu"] }],
          cards: [],
          actions: [{ kind: "add", enabled: true, id: "add" }],
        };
      }
      return {
        editors: [{ id: "editor", values: [], blank: true }],
        cards: [{ values: ["firstu"] }],
        actions: [{ kind: "add", enabled: false, id: "add" }],
      };
    },
    async fillCurrentRecord() {
      return { filled: true };
    },
    async validateCurrent() {
      return { ok: true };
    },
    async advance() {
      clicks += 1;
      stage = "saved";
      return { timedOut: true };
    },
  };

  const result = await flow.createCoordinator(host).runSection({
    sectionKey: "education",
    sourceRecords: [entry, next],
  });
  assert.equal(clicks, 1);
  assert.ok(result.completed.includes(0));
});

test("coordinator fills out-of-order editors without adding", async () => {
  const editors = [
    { id: "e0", values: ["secondproject"] },
    { id: "e1", values: ["firstproject"] },
  ];
  const filled = [];
  const host = {
    observeSection() {
      return {
        editors,
        cards: [],
        actions: [{ kind: "add", enabled: true, id: "add" }],
      };
    },
    async fillCurrentRecord({ sourceIndex, editor }) {
      filled.push(`${editor.id}:${sourceIndex}`);
      return { filled: true };
    },
    async validateCurrent() {
      return { ok: true };
    },
    async advance() {
      throw new Error("should not add");
    },
  };
  const result = await flow.createCoordinator(host).runSection({
    sectionKey: "project",
    sourceRecords: [
      { sourceIndex: 0, primary: ["firstproject"], secondary: [] },
      { sourceIndex: 1, primary: ["secondproject"], secondary: [] },
    ],
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(filled.sort(), ["e0:1", "e1:0"]);
});

test("resolveCurrentRecord blocks ambiguous same-name cards without dates", () => {
  const plan = flow.resolveCurrentRecord(
    {
      editors: [],
      cards: [{ values: ["sameu"] }, { values: ["sameu"] }],
      actions: [],
    },
    [
      { sourceIndex: 0, primary: ["sameu"], secondary: ["2020"] },
      { sourceIndex: 1, primary: ["sameu"], secondary: ["2024"] },
    ],
    new Set()
  );
  assert.equal(plan.kind, "blocked");
  assert.equal(plan.reason, flow.BLOCK_REASONS.ambiguous_alignment);
});

test("coordinator reuses a rebuilt editor after save without counting nodes", async () => {
  let editorValues = [];
  let generation = 1;
  const cards = [];
  const filled = [];
  const host = {
    observeSection() {
      return {
        editors: [
          {
            id: `editor-gen-${generation}`,
            values: editorValues,
            blank: editorValues.length === 0,
          },
        ],
        cards: cards.map((values) => ({ values })),
        actions: [
          { kind: "save", enabled: editorValues.length > 0, id: "save" },
          { kind: "add", enabled: editorValues.length === 0, id: "add" },
        ],
      };
    },
    async fillCurrentRecord({ sourceIndex }) {
      filled.push(sourceIndex);
      editorValues = sourceIndex === 0 ? ["firstu"] : ["secondu"];
      return { filled: true };
    },
    async validateCurrent() {
      return { ok: true };
    },
    async advance(action) {
      if (action.kind !== "save") throw new Error("expected save on reused editor");
      cards.push([...editorValues]);
      editorValues = [];
      generation += 1;
      return { ok: true };
    },
  };
  const result = await flow.createCoordinator(host).runSection({
    sectionKey: "education",
    sourceRecords: [
      { sourceIndex: 0, primary: ["firstu"], secondary: [] },
      { sourceIndex: 1, primary: ["secondu"], secondary: [] },
    ],
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(filled, [0, 1]);
});

test("blocked missing-required message names the record and field", () => {
  assert.match(
    flow.formatBlockedMessage({
      sectionKey: "education",
      sourceIndex: 0,
      reason: flow.BLOCK_REASONS.missing_required,
      missingLabel: "学习形式",
    }),
    /第 1 条教育经历缺少“学习形式”/
  );
});
