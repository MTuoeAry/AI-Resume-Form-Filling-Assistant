const test = require('node:test');
const assert = require('node:assert/strict');
const { loadExtension } = require('./helpers/dom-extension');
const flow = require('../shared/repeat-flow');

test('unchanged add times out and is never clicked twice', async () => {
  let clicks = 0;
  const result = await flow.createCoordinator({
    observeSection: () => ({ editors: [{ id: 'editor', values: ['firstu'] }], cards: [],
      actions: [{ id: 'add', kind: 'add', enabled: true }] }),
    fillCurrentRecord: async () => ({ filled: true }),
    validateCurrent: async () => ({ ok: true }),
    advance: async () => { clicks += 1; return { timedOut: true }; },
  }).runSection({ sectionKey: 'education', sourceRecords: [
    { sourceIndex: 0, primary: ['firstu'], secondary: [] },
    { sourceIndex: 1, primary: ['secondu'], secondary: [] },
  ] });
  assert.equal(clicks, 1);
  assert.equal(result.blocked.reason, flow.BLOCK_REASONS.transition_uncertain);
});

test('repeat wait ignores spinner mutations and never scans outside its section', async () => {
  const ext = loadExtension('<section id="edu"><input value="School"><i id="spinner"></i></section><aside id="other"></aside>');
  try {
    const d = ext.window.document;
    const before = ext.api.captureRepeatFlowState(d.getElementById('edu'));
    const original = d.querySelectorAll.bind(d);
    d.querySelectorAll = () => { throw new Error('whole document scan in wait'); };
    const wait = ext.api.waitForRepeatFlowChange(before);
    for (let i = 0; i < 200; i++) {
      d.getElementById('spinner').setAttribute('style', `transform:rotate(${i}deg)`);
      d.getElementById('other').textContent = String(i);
    }
    assert.equal(await wait, false);
    d.querySelectorAll = original;
  } finally { ext.close(); }
});

test('repeat wait detects value-only reset and same-count editor replacement', async () => {
  const ext = loadExtension('<section><input value="School"></section>');
  try {
    const root = ext.window.document.querySelector('section');
    let before = ext.api.captureRepeatFlowState(root);
    root.querySelector('input').value = '';
    assert.equal(await ext.api.waitForRepeatFlowChange(before), true);
    before = ext.api.captureRepeatFlowState(root);
    root.innerHTML = '<input>';
    assert.equal(await ext.api.waitForRepeatFlowChange(before), true);
  } finally { ext.close(); }
});

test('repeat wait has a fixed deadline and cleans up pending polling', async () => {
  const ext = loadExtension('<section><input></section>');
  try {
    const timers = new Map();
    let id = 0;
    ext.window.setTimeout = (fn, delay) => { timers.set(++id, { fn, delay }); return id; };
    ext.window.clearTimeout = key => timers.delete(key);
    const pending = ext.api.waitForRepeatFlowChange(ext.api.captureRepeatFlowState(ext.window.document.querySelector('section')));
    const deadline = [...timers.values()].find(timer => timer.delay === flow.WAIT_MS);
    assert.ok(deadline);
    deadline.fn();
    assert.equal(await pending, false);
    assert.equal(timers.size, 0);
  } finally { ext.close(); }
});

test('stopping during add wait ends the run and does not fill the next record', async () => {
  const ext = loadExtension('<main><section><h2>教育经历</h2><article><label>学校名称<input id="school"></label></article><button id="add" type="button">新增教育经历</button></section></main>');
  try {
    const d = ext.window.document;
    let clicks = 0;
    d.getElementById('add').addEventListener('click', () => {
      clicks += 1;
      void ext.request({ action: 'cancelFill' });
    });
    const result = await ext.request({ action: 'startFill', fillMode: 'overwrite', scope: 'page',
      resumeProfile: ext.window.ResumeSchema.normalizeResumeProfile({ educations: [
        { school: 'First University' }, { school: 'Second University' },
      ] }) });
    assert.equal(result.canceled, true);
    assert.equal(clicks, 1);
    assert.equal(d.getElementById('school').value, 'First University');
  } finally { ext.close(); }
});

test('picker uses its owned portal instead of another open menu', () => {
  const ext = loadExtension('<div id="picker"><input aria-controls="own"></div><ul id="other" role="listbox"><li role="option">硕士</li></ul><ul id="own" role="listbox"><li role="option">本科</li></ul>');
  try {
    const d = ext.window.document;
    const runtime = { pickerRoot: d.getElementById('picker'), el: d.querySelector('input') };
    assert.deepEqual(Array.from(ext.api.getScopedCustomPickerOptions(runtime), x => x.label), ['本科']);
  } finally { ext.close(); }
});

test('menu option text cannot be mistaken for the selected value', () => {
  const ext = loadExtension('<div id="picker"><input><ul role="listbox"><li role="option">硕士</li></ul></div>');
  try {
    const runtime = { pickerRoot: ext.window.document.getElementById('picker'), el: ext.window.document.querySelector('input') };
    assert.equal(ext.api.getCustomPickerRootText(runtime), '');
    assert.equal(ext.api.customPickerValueMatches(runtime, '硕士'), false);
  } finally { ext.close(); }
});

test('failed picker restores its query, closes its menu and never clicks a foreign option', async () => {
  const ext = loadExtension('<div id="picker"><input value="原值" aria-controls="own"></div><ul role="listbox"><li role="option">硕士</li></ul><ul id="own" role="listbox" hidden><li role="option">本科</li></ul>');
  try {
    const d = ext.window.document, root = d.getElementById('picker'), input = root.querySelector('input');
    let clicks = 0;
    d.querySelector('li').addEventListener('click', () => { clicks += 1; });
    root.addEventListener('click', () => { d.getElementById('own').hidden = false; });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') d.getElementById('own').hidden = true; });
    assert.equal(await ext.api.fillCustomPicker({ pickerRoot: root, el: input, searchInput: input }, '硕士'), false);
    assert.equal(clicks, 0);
    assert.equal(input.value, '原值');
    assert.equal(d.getElementById('own').hidden, true);
  } finally { ext.close(); }
});

test('successful picker also dismisses a menu that remains open after selecting', async () => {
  const ext = loadExtension('<div id="picker"><span class="single_selected"></span><input aria-controls="own"></div><ul id="own" role="listbox" hidden><li role="option">硕士</li></ul>');
  try {
    const d = ext.window.document, root = d.getElementById('picker'), input = root.querySelector('input');
    root.addEventListener('click', () => { d.getElementById('own').hidden = false; });
    d.querySelector('li').addEventListener('click', () => { root.querySelector('span').textContent = '硕士'; });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') d.getElementById('own').hidden = true; });
    assert.equal(await ext.api.fillCustomPicker({ pickerRoot: root, el: input, searchInput: input }, '硕士'), true);
    assert.equal(root.querySelector('span').textContent, '硕士');
    assert.equal(d.getElementById('own').hidden, true);
  } finally { ext.close(); }
});
