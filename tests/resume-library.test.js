const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const library = require('../shared/resume-library');

const section = { key: 'projects', label: '项目经历', type: 'list', fields: [
  { key: 'name', label: '项目名称' }, { key: 'description', label: '项目描述' }, { key: 'startDate', label: '开始时间' },
] };
const longText = '<img src=x onerror=alert(1)>\n' + '完整描述。'.repeat(100);
const profile = { projects: [{ name: 'First' }, {}, { name: 'Third', description: longText, startDate: '2024-03' }] };

test('library cards show birthDate when start and end dates are absent', () => {
  const familySection = {
    key: 'familyMembers', label: '亲属信息', type: 'list', itemLabel: '家庭成员',
    fields: [{ key: 'name', label: '亲属姓名' }, { key: 'birthDate', label: '出生日期' }],
  };
  const awardSection = {
    key: 'awards', label: '获奖经历', type: 'list', itemLabel: '奖项',
    fields: [{ key: 'name', label: '奖项名称' }, { key: 'date', label: '获奖时间' }],
  };
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector('#host');
  const view = library.createView(host, { schema: { sections: [familySection, awardSection] },
    onCopy() {}, onFill() {} });
  try {
    view.render({
      familyMembers: [{ name: '李四', birthDate: '1970-03' }],
      awards: [{ name: '一等奖', date: '2023-06' }],
    });
    assert.equal(host.querySelector('[data-section="familyMembers"] .library-record-dates').textContent, '1970-03');
    assert.equal(host.querySelector('[data-section="awards"] .library-record-dates').textContent, '2023-06');
  } finally { dom.window.close(); }
});

test('copy formats retain full text, newlines and labels only for whole records', () => {
  assert.equal(library.recordFields(section, profile.projects[2])[1].value, longText);
  assert.equal(library.formatRecord(section, profile.projects[2]), `项目名称：Third\n项目描述：${longText}\n开始时间：2024-03`);
  assert.equal(library.textValue(false), 'false');
  assert.equal(library.textValue(0), '0');
});

test('library selects original record index and copies independently of target or busy state', () => {
  const dom = new JSDOM('<div id="host"></div>');
  const host = dom.window.document.querySelector('#host');
  const copies = [], fills = [];
  const view = library.createView(host, { schema: { sections: [section] },
    onCopy: value => copies.push(value), onFill: (...args) => fills.push(args) });
  try {
    view.render(profile);
    const card = host.querySelector('[data-index="2"]');
    assert.equal(card.querySelector('[data-library-fill]').disabled, true);
    card.querySelector('[aria-label="复制项目描述"]').click();
    assert.equal(copies[0], longText);
    assert.equal(card.querySelector('img'), null);
    view.updateState({ targetReady: true });
    card.querySelector('[data-library-fill]').click();
    assert.deepEqual(fills, [['projects', 2]]);
    view.updateState({ busy: true });
    card.querySelector('[aria-label="复制项目名称"]').click();
    assert.equal(copies[1], 'Third');
    assert.equal(card.querySelector('[data-library-fill]').disabled, true);
    host.querySelector('details').open = true;
    card.querySelector('details').open = true;
    view.render(profile);
    assert.equal(host.querySelector('details').open, true);
    assert.equal(host.querySelector('[data-index="2"] details').open, true);
    view.render({ projects: [{ name: 'Other template' }] });
    assert.equal(host.textContent.includes('Third'), false);
  } finally { dom.window.close(); }
});
