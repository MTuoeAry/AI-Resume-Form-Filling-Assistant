const test = require('node:test');
const assert = require('node:assert/strict');
const { loadExtension } = require('./helpers/dom-extension');

const row = (label, control) => `<dl><dt>${label}</dt><dd>${control}</dd></dl>`;
const select = (id, choices) => `<div id="${id}" class="dropdown"><span>请选择</span><ul hidden>${choices.map((text, i) => `<li data-code="${i}">${text}</li>`).join('')}</ul></div>`;
const calendar = id => `<div id="${id}" class="date-widget"><span>请选择</span><div class="years" hidden><ul>${[2023,2024,2025,2026,2027].map(y => `<li>${y}</li>`).join('')}</ul></div><div class="months" hidden><ul>${Array.from({length:12}, (_, i) => `<li>${i+1}</li>`).join('')}</ul></div></div>`;
function wireWidgets(w) {
  for (const root of w.document.querySelectorAll('.dropdown')) {
    root.addEventListener('click', event => {
      if (event.target.matches('li')) {
        root.firstElementChild.textContent = event.target.textContent;
        root.dataset.value = event.target.dataset.code;
        root.querySelector('ul').hidden = true;
      } else root.querySelector('ul').hidden = false;
    });
  }
  for (const root of w.document.querySelectorAll('.date-widget')) {
    let year;
    root.addEventListener('click', event => {
      if (event.target.matches('.years li')) {
        year = event.target.textContent;
        root.querySelector('.years').hidden = true;
        root.querySelector('.months').hidden = false;
      } else if (event.target.matches('.months li')) {
        root.firstElementChild.textContent = `${year}-${event.target.textContent.padStart(2,'0')}`;
        root.querySelector('.months').hidden = true;
      } else root.querySelector('.years').hidden = false;
    });
  }
}

for (const layout of [
  { name:'identifier with unrelated surrounding headings', open:'<div id="educationInfo">', heading:'' },
  { name:'unknown identifier and explicit heading', open:'<section id="random-42">', heading:'<h2>Education history</h2>' },
  { name:'accessible section without an identifier', open:'<fieldset aria-label="教育背景">', heading:'' },
]) {
  test(`scan → map → fill across ${layout.name}`, async () => {
    const end = layout.open.startsWith('<fieldset') ? '</fieldset>' : layout.open.startsWith('<section') ? '</section>' : '</div>';
    const html = `<main><section><h2>Project experience</h2>${row('项目名称','<input value="Existing project">')}</section>${layout.open}${layout.heading}
      ${row('时间',calendar('begin')+' — '+calendar('finish'))}
      ${row('学历',select('qualification',['大学本科','硕士研究生']))}
      ${row('学位',select('academic',['学士','硕士']))}
      ${row('学校名称','<input id="school" value="输入学校名称">')}
      ${row('专业课程','<textarea id="courses"></textarea>')}
      ${row('专业描述','<textarea id="description"></textarea>')}
      <dl><dt>是否全日制* <input type="radio" name="fullTime" data-code="Y">是 <input type="radio" name="fullTime" data-code="N">否</dt></dl>
      <dl><dt>是否最高学历 <input type="radio" name="highest">是 <input type="radio" name="highest">否</dt></dl>
      ${end}<section><h2>Work history</h2>${row('公司名称','<input>')}</section></main>`;
    const ext = loadExtension(html);
    try {
      wireWidgets(ext.window);
      const profile = ext.window.ResumeSchema.normalizeResumeProfile({educations:[{school:'Example University',degree:'硕士',academicDegree:'硕士',startDate:'2024-09-15',endDate:'2027-06-20',isFullTime:'是',courses:'Algorithms',majorDescription:'Study of computation'}]});
      const scan=ext.api.scanFields();
      const fields=scan.fields.filter(f=>f.sectionKey==='education');
      assert.equal(fields.length,9, JSON.stringify(scan.fields));
      assert.ok(fields.every(f=>f.sectionLocked && f.sectionItemIndex===0));
      assert.deepEqual(Array.from(fields.find(f=>f.name==='fullTime').options),['是','否']);
      const mappings=ext.api.normalizeMappings([],scan.fields,profile);
      const mappingFor=id=>mappings.find(m=>m.fieldId===fields.find(f=>f.id===id)?.fieldId)?.resumePath;
      assert.equal(mappingFor('begin'),'educations.0.startDate');
      assert.equal(mappingFor('finish'),'educations.0.endDate');
      assert.equal(mappingFor('qualification'),'educations.0.degree');
      assert.equal(mappingFor('academic'),'educations.0.academicDegree');
      assert.equal(mappingFor('courses'),'educations.0.courses');
      assert.equal(mappingFor('description'),'educations.0.majorDescription');
      const highest=fields.find(f=>f.name==='highest');
      assert.ok(!mappings.find(m=>m.fieldId===highest.fieldId)?.resumePath);
      for (const mapping of mappings.filter(m=>m.resumePath.startsWith('educations.'))) {
        const runtime=scan.runtime.find(r=>r.fieldId===mapping.fieldId);
        const value=ext.window.ResumeSchema.getValueByPath(profile,mapping.resumePath);
        assert.equal((await ext.api.fillOne(runtime,value,{overwrite:false})).filled,true,mapping.resumePath);
      }
      assert.equal(ext.window.document.querySelector('#begin span').textContent,'2024-09');
      assert.equal(ext.window.document.querySelector('#qualification span').textContent,'硕士研究生');
      assert.equal(ext.window.document.querySelector('#school').value,'Example University');
      assert.equal(ext.window.document.querySelector('[name="fullTime"]').checked,true);
      const scannedAgain=ext.api.scanFields();
      const school=scannedAgain.runtime.find(r=>r.id==='school');
      assert.equal((await ext.api.fillOne(school,'Wrong University',{overwrite:false})).skipped,true);
    } finally { ext.close(); }
  });
}

test('repeated cards share one item identity, preserve radio boundaries, and align out-of-order sources', () => {
  const card = (school, id) => `<article class="card">${row('学校名称',`<input id="school${id}" value="${school}">`)}${row('专业','<input>')}<dl><dt>是否全日制 <input type="radio" name="fullTime">是 <input type="radio" name="fullTime">否</dt></dl></article>`;
  const ext=loadExtension(`<form><h2>Education</h2>${card('Second University',2)}${card('First University',1)}</form>`);
  try {
    const scan=ext.api.scanFields();
    assert.equal(scan.fields.filter(f=>f.kind==='radio_group').length,2);
    assert.deepEqual(Array.from(new Set(scan.fields.map(f=>f.sectionItemIndex))),[0,1]);
    ext.api.alignIncrementalRepeatSourceIndexes(scan,{educations:[{school:'First University'},{school:'Second University'}]});
    assert.equal(scan.fields.find(f=>f.id==='school2').sectionItemIndex,1);
    const malicious=scan.fields.map(f=>({fieldId:f.fieldId,resumePath:'projects.0.startDate'}));
    const mappings=ext.api.normalizeMappings(malicious,scan.fields);
    assert.ok(mappings.every(m=>!m.resumePath || m.resumePath.startsWith('educations.')));
  } finally {ext.close();}
});

test('heading beats misleading container identifier and content cannot contaminate peer sections', () => {
  const ext=loadExtension(`<main><div id="workInfo"><h3>实习经历</h3>${row('公司名称','<input>')}${row('描述','<textarea></textarea>')}</div><section><h3>项目经历</h3>${row('项目名称','<input>')}<p>教育经历、学校、学历、专业、毕业时间</p></section></main>`);
  try {
    const fields=ext.api.scanFields().fields;
    assert.equal(fields[0].sectionKey,'internship');
    assert.equal(fields[1].sectionKey,'internship');
    assert.equal(fields[2].sectionKey,'project');
  } finally {ext.close();}
});

test('navigation and decorative lists are not input controls; unmatched choices leave values intact', async () => {
  const ext=loadExtension(`<nav>${select('nav',['首页','职位'])}</nav><section><h2>教育经历</h2><div><span>课程介绍</span><ul><li>数学</li><li>物理</li></ul></div>${row('学历',select('level',['大学本科','硕士研究生']))}</section>`);
  try {
    wireWidgets(ext.window);
    const scan=ext.api.scanFields();
    assert.equal(scan.fields.length,1);
    assert.equal((await ext.api.fillOne(scan.runtime[0],'火星大学')).filled,false);
    assert.equal(ext.window.document.querySelector('#level span').textContent,'请选择');
  } finally {ext.close();}
});

test('old education data does not invent a degree or full-time status', () => {
  const ext=loadExtension('');
  try {
    const profile=ext.window.ResumeSchema.normalizeResumeProfile({educations:[{degree:'本科',school:'Example University'}]});
    assert.equal(profile.educations[0].degree,'本科');
    assert.equal(profile.educations[0].academicDegree,'');
    assert.equal(profile.educations[0].isFullTime,'');
  } finally {ext.close();}
});

test('unknown fields receive only the current record candidates and cross-record AI mappings are rejected', () => {
  const ext=loadExtension(`<section><h2>Education</h2>${row('附属信息','<input id="unknown">')}</section>`);
  try {
    const profile=ext.window.ResumeSchema.normalizeResumeProfile({educations:[{school:'First'},{school:'Second'}],projects:[{name:'Other'}]});
    const scan=ext.api.scanFields();
    const payload=ext.api.buildFieldMappingPayload(scan.fields,profile);
    assert.deepEqual(Array.from(payload.fields[0].allowedResumePaths),['educations.0.school']);
    for (const resumePath of ['projects.0.name','educations.1.school']) {
      assert.equal(ext.api.normalizeMappings([{fieldId:scan.fields[0].fieldId,resumePath}],scan.fields,profile)[0].resumePath,'');
    }
  } finally {ext.close();}
});

test('full execution keeps local results when the AI request fails and reports unfinished fields', async () => {
  const ext=loadExtension(`<section><h2>Education</h2>${row('学校名称','<input id="school">')}${row('未定义的字段','<input id="unknown">')}</section>`);
  try {
    const profile=ext.window.ResumeSchema.normalizeResumeProfile({educations:[{school:'Local University'}]});
    const result=await ext.request({action:'startFill',modelId:'test',resumeProfile:profile,fillMode:'incremental',scope:'page'});
    assert.equal(result.success,true,JSON.stringify(result));
    assert.equal(result.outcome,'partial');
    assert.equal(result.unmappedCount,1);
    assert.equal(result.filledCount,1);
    assert.equal(ext.window.document.querySelector('#school').value,'Local University');
    assert.equal(ext.window.document.querySelector('#unknown').value,'');
  } finally {ext.close();}
});

test('without a model the production entry point fills local mappings and a repeat run preserves values', async () => {
  const ext=loadExtension(`<section><h2>Education</h2>${row('学校名称','<input id="school">')}${row('未定义的字段','<input>')}</section>`);
  try {
    const profile=ext.window.ResumeSchema.normalizeResumeProfile({educations:[{school:'Local University'}]});
    const message={action:'startFill',modelId:'',resumeProfile:profile,fillMode:'incremental',scope:'page'};
    assert.equal((await ext.request(message)).filledCount,1);
    const again=await ext.request(message);
    assert.equal(again.filledCount,0);
    assert.equal(again.preservedCount,1);
    assert.equal(ext.window.document.querySelectorAll('input').length,2);
  } finally {ext.close();}
});

test('text filling does not turn resume content into a legacy focus-cleared default value', async () => {
  const ext=loadExtension(`<section><h2>实习经历</h2>${row('工作单位','<input id="companyName" value="">')}${row('职务','<input id="job" value="">')}</section>`);
  try {
    for (const input of ext.window.document.querySelectorAll('input')) {
      input.addEventListener('focus', () => {
        if (input.value && input.value === input.defaultValue) input.value = '';
      });
    }

    const scan=ext.api.scanFields();
    const company=scan.runtime.find(runtime=>runtime.id==='companyName');
    const job=scan.runtime.find(runtime=>runtime.id==='job');
    assert.equal((await ext.api.fillOne(company,'示例科技有限公司')).filled,true);
    assert.equal((await ext.api.fillOne(job,'算法工程师实习生')).filled,true);

    const companyInput=ext.window.document.querySelector('#companyName');
    const jobInput=ext.window.document.querySelector('#job');
    assert.equal(companyInput.defaultValue,'');
    assert.equal(jobInput.defaultValue,'');
    companyInput.focus();
    jobInput.focus();
    assert.equal(companyInput.value,'示例科技有限公司');
    assert.equal(jobInput.value,'算法工程师实习生');
  } finally {ext.close();}
});

test('associated English labels outrank conflicting identifiers in a conventional form', () => {
  const ext=loadExtension(`<fieldset><legend>Education</legend>
    <label for="degree">Education level</label><select id="degree"><option>Bachelor</option></select>
    <label for="schoolName">Academic degree</label><select id="schoolName"><option>Bachelor</option></select>
    <label for="start">Start date</label><input id="start" type="date">
    <label for="end">End date</label><input id="end" type="date">
    <label for="notes">Major description</label><textarea id="notes"></textarea>
    </fieldset>`);
  try {
    const scan=ext.api.scanFields();
    const mappings=ext.api.normalizeMappings([],scan.fields);
    const paths=Object.fromEntries(scan.fields.map(f=>[f.id,mappings.find(m=>m.fieldId===f.fieldId)?.resumePath]));
    assert.equal(paths.degree,'educations.0.degree');
    assert.equal(paths.schoolName,'educations.0.academicDegree');
    assert.equal(paths.start,'educations.0.startDate');
    assert.equal(paths.end,'educations.0.endDate');
    assert.equal(paths.notes,'educations.0.majorDescription');
  } finally {ext.close();}
});

test('random identifiers containing education do not lock an unlabeled field', () => {
  const ext=loadExtension(`<div id="sidebar-education-widget">${row('备注','<input id="note">')}</div>`);
  try {
    const field=ext.api.scanFields().fields.find(f=>f.id==='note');
    assert.equal(field.sectionLocked,false);
    assert.notEqual(field.sectionKey,'education');
  } finally { ext.close(); }
});

test('paired date inputs in one labeled row receive start and end roles', () => {
  const ext=loadExtension(`<section><h2>教育经历</h2>${row('时间','<input id="begin" type="date"><input id="finish" type="date">')}</section>`);
  try {
    const fields=ext.api.scanFields().fields;
    assert.equal(fields.find(f=>f.id==='begin').compositeRole,'start');
    assert.equal(fields.find(f=>f.id==='finish').compositeRole,'end');
    const mappings=ext.api.normalizeMappings([],fields);
    assert.equal(mappings.find(m=>m.fieldId===fields.find(f=>f.id==='begin').fieldId).resumePath,'educations.0.startDate');
    assert.equal(mappings.find(m=>m.fieldId===fields.find(f=>f.id==='finish').fieldId).resumePath,'educations.0.endDate');
  } finally { ext.close(); }
});

test('cached cross-section mappings are rejected by the same local gates', () => {
  const ext=loadExtension(`<section><h2>教育经历</h2>${row('学校名称','<input id="school">')}</section>`);
  try {
    const profile=ext.window.ResumeSchema.normalizeResumeProfile({educations:[{school:'Example University'}],projects:[{name:'Other'}]});
    const scan=ext.api.scanFields();
    const mappings=ext.api.normalizeMappings(
      [{fieldId:scan.fields[0].fieldId,resumePath:'projects.0.name'}],
      scan.fields,
      profile
    );
    assert.equal(mappings[0].resumePath,'educations.0.school');
  } finally { ext.close(); }
});

test('native date inputs skip year-month facts instead of inventing day 1', async () => {
  const ext=loadExtension(`<section><h2>教育经历</h2>${row('入学时间','<input id="start" type="date">')}</section>`);
  try {
    const runtime=ext.api.scanFields().runtime[0];
    assert.equal((await ext.api.fillOne(runtime,'2024-09')).filled,false);
    assert.equal(ext.window.document.querySelector('#start').value,'');
    assert.equal((await ext.api.fillOne(runtime,'2024-09-15')).filled,true);
    assert.equal(ext.window.document.querySelector('#start').value,'2024-09-15');
  } finally { ext.close(); }
});

test('contenteditable filling verifies the live text and restores a failed write', async () => {
  const ext=loadExtension(`<section><h2>项目经历</h2>${row('项目描述','<div id="desc" contenteditable="true"></div>')}</section>`);
  try {
    const runtime=ext.api.scanFields().runtime[0];
    assert.equal((await ext.api.fillOne(runtime,'Built a compiler')).filled,true);
    assert.equal(ext.window.document.querySelector('#desc').textContent,'Built a compiler');
    runtime.el.addEventListener('input',()=>{ runtime.el.textContent=''; },{once:true});
    assert.equal((await ext.api.fillOne(runtime,'Should not stick')).filled,false);
    assert.equal(ext.window.document.querySelector('#desc').textContent,'Built a compiler');
  } finally { ext.close(); }
});

test('a day calendar requires a real day and rejects adjacent-month cells', async () => {
  const ext=loadExtension(`<section><h2>教育背景</h2>${row('入学时间',calendar('calendar'))}</section>`);
  try {
    const w=ext.window,root=w.document.getElementById('calendar');
    const dayPanel=w.document.createElement('div');dayPanel.hidden=true;
    dayPanel.innerHTML='<ul><li class="previous-month">15</li><li>15</li></ul>';root.append(dayPanel);
    let year,month;
    root.addEventListener('click',event=>{
      if(event.target.matches('.years li')) {year=event.target.textContent;root.querySelector('.years').hidden=true;root.querySelector('.months').hidden=false;}
      else if(event.target.matches('.months li')) {month=event.target.textContent.padStart(2,'0');root.querySelector('.months').hidden=true;dayPanel.hidden=false;}
      else if(dayPanel.contains(event.target)) {assert.ok(!event.target.classList.contains('previous-month'));root.firstElementChild.textContent=`${year}-${month}-${event.target.textContent}`;dayPanel.hidden=true;}
      else root.querySelector('.years').hidden=false;
    });
    let runtime=ext.api.scanFields().runtime[0];
    assert.equal((await ext.api.fillOne(runtime,'2024-09')).filled,false);
    assert.equal(root.firstElementChild.textContent,'请选择');
    dayPanel.hidden=true;
    runtime=ext.api.scanFields().runtime[0];
    assert.equal((await ext.api.fillOne(runtime,'2024-09-15')).filled,true);
    assert.equal(root.firstElementChild.textContent,'2024-09-15');
  } finally {ext.close();}
});
