const test = require('node:test');
const assert = require('node:assert/strict');
const { loadExtension } = require('./helpers/dom-extension');

const row = (label, control) => `<dl><dt>${label}</dt><dd>${control}</dd></dl>`;
const card = id => `<article id="${id}">${row('项目名称', '<input name="projectName">')}${row('项目描述', '<textarea></textarea>')}</article>`;
function fixture() {
  const ext = loadExtension(`<section><h2>项目经历</h2>${card('first')}${card('second')}<button type="button">新增</button><button type="submit">提交</button></section>`);
  for (const [index, article] of Array.from(ext.window.document.querySelectorAll('article')).entries()) {
    article.querySelectorAll('input,textarea').forEach(node => {
      node.getBoundingClientRect = () => ({ left: index * 300, right: index * 300 + 100, top: 0, bottom: 30, width: 100, height: 30 });
    });
  }
  return ext;
}
const firstRect = { left: -10, top: -10, right: 150, bottom: 100 };
const record = { name: 'Third project', description: 'Only the chosen record\nFull description' };

test('selected source fills only one bound editor, preserves existing values, and never adds or submits', async () => {
  const ext = fixture();
  try {
    let clicks = 0;
    ext.window.document.querySelectorAll('button').forEach(button => button.onclick = () => clicks++);
    const target = ext.api.bindRecordTarget(firstRect);
    assert.equal(target.fieldCount, 2);
    let result = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record });
    assert.equal(result.success, true, result.message);
    assert.equal(result.filledCount, 2, JSON.stringify(result));
    assert.equal(ext.window.document.querySelector('#first input').value, record.name);
    assert.equal(ext.window.document.querySelector('#first textarea').value, record.description);
    assert.equal(ext.window.document.querySelector('#second input').value, '');
    assert.equal(clicks, 0);
    result = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record: { ...record, name: 'Replacement' } });
    assert.equal(result.preservedCount, 2);
    assert.equal(ext.window.document.querySelector('#first input').value, record.name);
    result = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record: { ...record, name: 'Replacement' }, overwrite: true });
    assert.equal(result.filledCount, 2);
    assert.equal(ext.window.document.querySelector('#first input').value, 'Replacement');
  } finally { ext.close(); }
});

test('selection remains bound to nodes after scrolling instead of filling coordinates', async () => {
  const ext = fixture();
  try {
    const target = ext.api.bindRecordTarget(firstRect);
    ext.window.document.querySelectorAll('#first input,#first textarea').forEach(node => {
      node.getBoundingClientRect = () => ({ left: 500, right: 600, top: 200, bottom: 230, width: 100, height: 30 });
    });
    const result = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record });
    assert.equal(result.filledCount, 2, result.message);
    assert.equal(ext.window.document.querySelector('#second input').value, '');
  } finally { ext.close(); }
});

test('multiple records in one selection are rejected before writing', () => {
  const ext = fixture();
  try { assert.throws(() => ext.api.bindRecordTarget({ ...firstRect, right: 500 }), /多个区块或多条经历/); }
  finally { ext.close(); }
});

test('replaced nodes and stale tokens cannot silently target another editor', async () => {
  const ext = fixture();
  try {
    const target = ext.api.bindRecordTarget(firstRect);
    const old = ext.window.document.querySelector('#first');
    old.replaceWith(old.cloneNode(true));
    const result = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record });
    assert.equal(result.success, false);
    assert.match(result.message, /变化|失效/);
    assert.equal(ext.window.document.querySelector('#first input').value, '');
    assert.equal(ext.window.document.querySelector('#second input').value, '');
  } finally { ext.close(); }
});

test('wrong section and cleared selection are rejected without changes', async () => {
  const ext = fixture();
  try {
    const target = ext.api.bindRecordTarget(firstRect);
    const wrong = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'educations', record: { school: 'Wrong school' } });
    assert.equal(wrong.success, false);
    assert.match(wrong.message, /不一致/);
    await ext.request({ action: 'clearRecordTarget' });
    const cleared = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record });
    assert.equal(cleared.success, false);
    assert.equal(ext.window.document.querySelector('#first input').value, '');
  } finally { ext.close(); }
});

test('unknown labels remain available for manual copy when AI fails', async () => {
  const ext = loadExtension(`<section><h2>项目经历</h2>${row('项目名称', '<input>')}${row('自定义备注甲', '<textarea></textarea>')}</section>`);
  try {
    const target = ext.api.bindRecordTarget(firstRect);
    const result = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record, modelId: 'offline' });
    assert.equal(result.success, true, result.message);
    assert.equal(result.filledCount, 1);
    assert.equal(result.unmappedCount, 1);
    assert.match(result.message, /复制/);
    const payload = ext.logs.find(message => message.action === 'callAI');
    assert.ok(payload);
    assert.equal(ext.window.document.querySelector('textarea').value, '');
  } finally { ext.close(); }
});

test('AI candidates contain only the chosen record and cross-record or cross-section paths are rejected', async () => {
  const ext = loadExtension(`<section><h2>项目经历</h2>${row('未定义信息甲', '<input>')}${row('未定义信息乙', '<textarea></textarea>')}</section>`);
  try {
    let capturedPayload;
    ext.window.chrome.runtime.sendMessage = (message, callback) => {
      if (message.action !== 'callAI') return;
      const payload = JSON.parse(message.prompt);
      capturedPayload = payload;
      callback({ success: true, data: JSON.stringify({ mappings: [
        { fieldId: payload.fields[0].fieldId, resumePath: 'projects.1.name' },
        { fieldId: payload.fields[1].fieldId, resumePath: 'educations.0.school' },
      ] }) });
    };
    const target = ext.api.bindRecordTarget(firstRect);
    const result = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record, modelId: 'test' });
    assert.equal(result.success, true);
    assert.equal(result.filledCount, 0);
    assert.equal(result.unmappedCount, 2);
    assert.ok(capturedPayload.resumeFields.length > 0);
    assert.ok(capturedPayload.resumeFields.every(field => field.path.startsWith('projects.0.')));
    assert.ok(capturedPayload.fields.every(field => field.allowedResumePaths.every(path => path.startsWith('projects.0.'))));
  } finally { ext.close(); }
});

test('selection changes during model request stop writes, even when model result is valid', async () => {
  const ext = loadExtension(`<section><h2>项目经历</h2>${row('未定义信息', '<input>')}</section>`);
  try {
    ext.window.chrome.runtime.sendMessage = (message, callback) => {
      if (message.action !== 'callAI') return;
      const payload = JSON.parse(message.prompt);
      const input = ext.window.document.querySelector('input');
      input.replaceWith(input.cloneNode());
      callback({ success: true, data: JSON.stringify([{ fieldId: payload.fields[0].fieldId, resumePath: 'projects.0.name' }]) });
    };
    const target = ext.api.bindRecordTarget(firstRect);
    const result = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record, modelId: 'test' });
    assert.equal(result.success, false);
    assert.equal(ext.window.document.querySelector('input').value, '');
  } finally { ext.close(); }
});

test('a partial radio group is excluded rather than changing options outside the target', () => {
  const ext = loadExtension('<section><h2>教育经历</h2><dl><dt>是否全日制</dt><dd><label><input type="radio" name="full">是</label><label><input type="radio" name="full">否</label></dd></dl></section>');
  try {
    ext.window.document.querySelectorAll('input').forEach((node, index) => {
      node.getBoundingClientRect = () => ({ left: index * 300, right: index * 300 + 100, top: 0, bottom: 30, width: 100, height: 30 });
    });
    assert.throws(() => ext.api.bindRecordTarget(firstRect), /未发现/);
    assert.equal(ext.window.document.querySelector('input').checked, false);
  } finally { ext.close(); }
});

function layoutControls(ext, selector = 'input,textarea,select') {
  Array.from(ext.window.document.querySelectorAll(selector)).forEach((node, index) => {
    node.getBoundingClientRect = () => ({
      left: index * 120, right: index * 120 + 100, top: 0, bottom: 30, width: 100, height: 30,
    });
  });
}

test('localized year-month dropdowns fill from YYYY-MM and later fields still write', async () => {
  const ext = loadExtension(`<section><h2>项目经历</h2>
    ${row('开始时间', '<select id="start"><option value="">请选择</option><option value="2024-08">2024年08月</option><option value="2024-09">2024年09月</option></select>')}
    ${row('项目名称', '<input name="projectName">')}
    ${row('项目描述', '<textarea></textarea>')}
  </section>`);
  try {
    layoutControls(ext);
    const target = ext.api.bindRecordTarget({ left: -10, top: -10, right: 400, bottom: 80 });
    const result = await ext.request({
      action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects',
      record: { ...record, startDate: '2024-09' },
    });
    assert.equal(result.success, true, result.message);
    assert.equal(ext.window.document.querySelector('#start').value, '2024-09');
    assert.equal(ext.window.document.querySelector('input[name="projectName"]').value, record.name);
    assert.equal(ext.window.document.querySelector('textarea').value, record.description);
    assert.equal(result.filledCount, 3, JSON.stringify(result));
  } finally { ext.close(); }
});

test('a rebuilt earlier control does not abort remaining selected fields', async () => {
  const ext = fixture();
  try {
    const input = ext.window.document.querySelector('#first input');
    input.addEventListener('change', () => input.replaceWith(input.cloneNode(true)));
    const target = ext.api.bindRecordTarget(firstRect);
    const result = await ext.request({ action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects', record });
    assert.equal(result.success, true, result.message);
    assert.equal(ext.window.document.querySelector('#first textarea').value, record.description);
    assert.equal(ext.window.document.querySelector('#second input').value, '');
  } finally { ext.close(); }
});

test('a failed day calendar does not block later selected fields', async () => {
  const monthItems = Array.from({ length: 12 }, (_, i) => `<li>${i + 1}</li>`).join('');
  const ext = loadExtension(`<section><h2>项目经历</h2>
    ${row('开始时间', '<div id="start" class="date-widget"><span>请选择</span><div class="years" hidden><ul><li>2023</li><li>2024</li><li>2025</li></ul></div><div class="months" hidden><ul>' + monthItems + '</ul></div></div>')}
    ${row('项目名称', '<input name="projectName">')}
  </section>`);
  try {
    const root = ext.window.document.getElementById('start');
    const dayPanel = ext.window.document.createElement('div');
    dayPanel.hidden = true;
    dayPanel.innerHTML = '<ul><li>15</li></ul>';
    root.append(dayPanel);
    let year;
    root.addEventListener('click', event => {
      if (event.target.matches('.years li')) {
        year = event.target.textContent;
        root.querySelector('.years').hidden = true;
        root.querySelector('.months').hidden = false;
      } else if (event.target.matches('.months li')) {
        root.querySelector('.months').hidden = true;
        dayPanel.hidden = false;
      } else if (dayPanel.contains(event.target)) {
        root.firstElementChild.textContent = `${year}-09-${event.target.textContent}`;
        dayPanel.hidden = true;
      } else root.querySelector('.years').hidden = false;
    });
    const nameInput = ext.window.document.querySelector('input[name="projectName"]');
    root.getBoundingClientRect = () => ({ left: 0, right: 100, top: 0, bottom: 30, width: 100, height: 30 });
    root.firstElementChild.getBoundingClientRect = root.getBoundingClientRect;
    nameInput.getBoundingClientRect = () => ({ left: 120, right: 220, top: 0, bottom: 30, width: 100, height: 30 });
    const target = ext.api.bindRecordTarget({ left: -10, top: -10, right: 250, bottom: 80 });
    const result = await ext.request({
      action: 'fillSelectedRecord', token: target.token, sectionKey: 'projects',
      record: { ...record, startDate: '2024-09' },
    });
    assert.equal(result.success, true, result.message);
    assert.equal(root.firstElementChild.textContent, '请选择');
    assert.equal(ext.window.document.querySelector('input[name="projectName"]').value, record.name);
    assert.match(result.message, /开始时间|待处理/);
  } finally { ext.close(); }
});
