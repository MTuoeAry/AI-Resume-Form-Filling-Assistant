// Local-only harness: no credentials, network requests, extension installation or submission.
(() => {
  let listener;
  const cache = {};
  window.chrome = { runtime: {
    onMessage: { addListener(fn) { listener = fn; } },
    sendMessage(message, callback) { if (message.action === 'callAI') callback({success:false,error:'模型已禁用'}); },
  }, storage: { local: { async get() { return cache; }, async set(value) { Object.assign(cache,value); } } } };

  const dates=document.getElementById('date-range');
  for (const id of ['begin','finish']) {
    const root=document.createElement('div'); root.id=id; root.className='date-widget';
    root.innerHTML='<span>请选择</span><div class="years" hidden><ul>'+[2023,2024,2025,2026,2027].map(y=>`<li>${y}</li>`).join('')+'</ul></div><div class="months" hidden><ul>'+Array.from({length:12},(_,i)=>`<li>${i+1}</li>`).join('')+'</ul></div>';
    dates.append(root);
    let year;
    root.addEventListener('click',event=>{
      if(event.target.matches('.years li')){year=event.target.textContent;root.querySelector('.years').hidden=true;root.querySelector('.months').hidden=false;}
      else if(event.target.matches('.months li')){root.firstElementChild.textContent=`${year}-${event.target.textContent.padStart(2,'0')}`;root.querySelector('.months').hidden=true;}
      else root.querySelector('.years').hidden=false;
    });
  }
  for(const root of document.querySelectorAll('.dropdown')) root.addEventListener('click',event=>{
    if(event.target.matches('li')){root.firstElementChild.textContent=event.target.textContent;root.dataset.value=event.target.dataset.code;root.querySelector('ul').hidden=true;}
    else root.querySelector('ul').hidden=false;
  });
  for(const id of ['companyName','job']) {
    const input=document.getElementById(id);
    input.addEventListener('focus',()=>{
      if(input.value && input.value===input.defaultValue) input.value='';
    });
  }
  const request=message=>new Promise(resolve=>listener(message,{},resolve));
  document.getElementById('run').addEventListener('click',async()=>{
    const output=document.getElementById('result'); output.textContent='运行中';
    const profile=window.ResumeSchema.normalizeResumeProfile({educations:[{school:'Example University',degree:'硕士',academicDegree:'硕士',startDate:'2024-09-15',endDate:'2027-06-20',isFullTime:'是',courses:'Algorithms',majorDescription:'Study of computation'}],internships:[{company:'Example Technology Co., Ltd.',title:'Algorithm Intern'}],projects:[{name:'Sample Project',role:'Developer'}]});
    const first=await request({action:'startFill',modelId:'',resumeProfile:profile,fillMode:'overwrite',scope:'page'});
    const second=await request({action:'startFill',modelId:'',resumeProfile:profile,fillMode:'incremental',scope:'page'});
    document.getElementById('companyName').focus();
    document.getElementById('job').focus();
    const values={school:document.getElementById('school').value,level:document.querySelector('#level > span').textContent,levelCode:document.getElementById('level').dataset.value,academic:document.querySelector('#academic > span').textContent,begin:document.querySelector('#begin > span').textContent,finish:document.querySelector('#finish > span').textContent,courses:document.getElementById('courses').value,description:document.getElementById('major-description').value,fullTime:document.querySelector('[name="fullTime"]').checked,company:document.getElementById('companyName').value,job:document.getElementById('job').value,companyDefault:document.getElementById('companyName').defaultValue,jobDefault:document.getElementById('job').defaultValue,project:document.getElementById('project').value,role:document.getElementById('role').value};
    const passed=first.filledCount===12 && second.filledCount===0 && second.preservedCount===12 && values.levelCode==='M' && values.begin==='2024-09' && values.finish==='2027-06' && values.school==='Example University' && values.fullTime && values.courses==='Algorithms' && values.company==='Example Technology Co., Ltd.' && values.job==='Algorithm Intern' && values.companyDefault==='' && values.jobDefault==='' && values.project==='Sample Project' && values.role==='Developer';
    output.textContent=JSON.stringify({passed,first,second,values},null,2);
    output.dataset.passed=String(passed);
  });
})();
