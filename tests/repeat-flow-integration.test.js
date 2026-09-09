const test = require("node:test");
const assert = require("node:assert/strict");
const { loadExtension } = require("./helpers/dom-extension");

function profileOf(ext, data) {
  return ext.window.ResumeSchema.normalizeResumeProfile(data);
}

function wireGatedAdd(document) {
  const school = document.getElementById("school");
  const start = document.getElementById("start");
  const add = document.getElementById("add-edu");
  const error = document.getElementById("edu-error");
  const cards = document.getElementById("edu-cards");
  const submit = document.getElementById("submit-app");
  document.__addClicks = 0;
  document.__submitClicks = 0;
  const sync = () => {
    add.disabled = String(school.value || "").trim().length < 2;
  };
  school.addEventListener("input", sync);
  school.addEventListener("change", sync);
  add.addEventListener("click", () => {
    if (add.disabled) return;
    document.__addClicks += 1;
    const card = document.createElement("article");
    card.className = "saved-card";
    card.innerHTML = `<strong>${school.value}</strong><span>${start.value || ""}</span>`;
    cards.append(card);
    school.value = "";
    start.value = "";
    if (error) error.hidden = true;
    sync();
  });
  submit?.addEventListener("click", () => {
    document.__submitClicks += 1;
  });
  sync();
}

function wireSaveThenAdd(document) {
  const school = document.getElementById("school");
  const start = document.getElementById("start");
  const save = document.getElementById("save-edu");
  const add = document.getElementById("add-edu");
  const editor = document.getElementById("edu-editor");
  const cards = document.getElementById("edu-cards");
  const error = document.getElementById("edu-error");
  document.__saveClicks = 0;
  document.__addClicks = 0;
  document.__submitClicks = 0;
  save.addEventListener("click", () => {
    if (String(school.value || "").trim().length < 2) {
      error.hidden = false;
      error.textContent = "请填写学校名称";
      return;
    }
    document.__saveClicks += 1;
    const card = document.createElement("article");
    card.className = "saved-card";
    card.innerHTML = `<strong>${school.value}</strong><span>${start.value || ""}</span><button type="button">编辑</button>`;
    cards.append(card);
    school.value = "";
    start.value = "";
    editor.hidden = true;
    add.disabled = false;
    error.hidden = true;
  });
  add.addEventListener("click", () => {
    document.__addClicks += 1;
    editor.hidden = false;
    add.disabled = true;
  });
  document.getElementById("submit-app")?.addEventListener("click", () => {
    document.__submitClicks += 1;
  });
}

function wireAddValidates(document) {
  const school = document.getElementById("school");
  const add = document.getElementById("add-edu");
  const error = document.getElementById("edu-error");
  const cards = document.getElementById("edu-cards");
  document.__addClicks = 0;
  add.addEventListener("click", () => {
    document.__addClicks += 1;
    if (String(school.value || "").trim().length < 2) {
      error.hidden = false;
      error.textContent = "学校名称不能为空";
      return;
    }
    const card = document.createElement("article");
    card.className = "saved-card";
    card.innerHTML = `<strong>${school.value}</strong>`;
    cards.append(card);
    school.value = "";
    error.hidden = true;
  });
}

const gatedMarkup = `
<section>
  <h2>教育经历</h2>
  <div id="edu-editor" class="card">
    <dl><dt>学校名称</dt><dd><input id="school"></dd></dl>
    <dl><dt>开始时间</dt><dd><input id="start"></dd></dl>
    <p id="edu-error" class="error" hidden></p>
  </div>
  <div id="edu-cards"></div>
  <button type="button" id="add-edu" disabled>新增教育经历</button>
  <button type="submit" id="submit-app">提交申请</button>
</section>`;

test("static education section with prompt values fills without requiring add", async () => {
  const ext = loadExtension(`<main>
    <section>
      <h2>教育经历</h2>
      <dl><dt>学校名称</dt><dd><input id="school" value="输入学校名称"></dd></dl>
      <dl><dt>专业课程</dt><dd><textarea id="courses"></textarea></dd></dl>
    </section>
  </main>`);
  try {
    await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [{ school: "Example University", courses: "Algorithms" }],
      }),
      fillMode: "overwrite",
      scope: "page",
    });
    assert.equal(ext.window.document.getElementById("school").value, "Example University");
    assert.equal(ext.window.document.getElementById("courses").value, "Algorithms");
  } finally {
    ext.close();
  }
});

test("gated add fills the first education record before the second editor appears", async () => {
  const ext = loadExtension(`<main>${gatedMarkup}</main>`);
  try {
    wireGatedAdd(ext.window.document);
    const result = await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [
          { school: "First University", startDate: "2020-09" },
          { school: "Second University", startDate: "2024-09" },
        ],
      }),
      fillMode: "overwrite",
      scope: "page",
    });
    const cards = [...ext.window.document.querySelectorAll(".saved-card strong")].map(
      (node) => node.textContent
    );
    assert.equal(ext.window.document.__submitClicks, 0);
    assert.equal(ext.window.document.__addClicks, 1);
    assert.ok(cards.includes("First University"));
    assert.equal(ext.window.document.getElementById("school").value, "Second University");
    assert.equal(result.success, true);
  } finally {
    ext.close();
  }
});

test("save-then-add does not click add before the current record is saved", async () => {
  const ext = loadExtension(`<main>
    <section>
      <h2>教育经历</h2>
      <div id="edu-editor" class="card">
        <dl><dt>学校名称</dt><dd><input id="school"></dd></dl>
        <dl><dt>开始时间</dt><dd><input id="start"></dd></dl>
        <p id="edu-error" class="error" hidden></p>
        <button type="button" id="save-edu">保存</button>
      </div>
      <div id="edu-cards"></div>
      <button type="button" id="add-edu" disabled>新增教育经历</button>
      <button type="submit" id="submit-app">提交申请</button>
    </section>
  </main>`);
  try {
    wireSaveThenAdd(ext.window.document);
    await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [
          { school: "First University", startDate: "2020-09" },
          { school: "Second University", startDate: "2024-09" },
        ],
      }),
      fillMode: "overwrite",
      scope: "page",
    });
    assert.equal(ext.window.document.__submitClicks, 0);
    assert.ok(ext.window.document.__saveClicks >= 1);
    assert.ok(ext.window.document.__addClicks <= ext.window.document.__saveClicks);
    assert.equal(
      ext.window.document.querySelector(".saved-card strong").textContent,
      "First University"
    );
    assert.equal(ext.window.document.getElementById("school").value, "Second University");
  } finally {
    ext.close();
  }
});

test("add that validates in place stays on the current record when required fields are empty", async () => {
  const ext = loadExtension(`<main>
    <section>
      <h2>教育经历</h2>
      <div id="edu-editor" class="card">
        <dl><dt>学校名称</dt><dd><input id="school"></dd></dl>
        <dl><dt>导师姓名</dt><dd><input id="advisor"></dd></dl>
        <p id="edu-error" class="error" hidden></p>
      </div>
      <div id="edu-cards"></div>
      <button type="button" id="add-edu">新增教育经历</button>
    </section>
  </main>`);
  try {
    const document = ext.window.document;
    const school = document.getElementById("school");
    const advisor = document.getElementById("advisor");
    const add = document.getElementById("add-edu");
    const error = document.getElementById("edu-error");
    document.__addClicks = 0;
    add.addEventListener("click", () => {
      document.__addClicks += 1;
      if (!school.value.trim() || !advisor.value.trim()) {
        error.hidden = false;
        error.textContent = "请填写导师姓名";
        return;
      }
      document.getElementById("edu-cards").innerHTML =
        `<article class="saved-card"><strong>${school.value}</strong></article>`;
      school.value = "";
      advisor.value = "";
    });
    const result = await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [
          { school: "First University" },
          { school: "Second University" },
        ],
      }),
      fillMode: "overwrite",
      scope: "page",
    });
    assert.equal(document.querySelectorAll(".saved-card").length, 0);
    assert.equal(school.value, "First University");
    assert.match(String(result.message || ""), /导师/);
  } finally {
    ext.close();
  }
});

test("already expanded editors are filled in place without extra add clicks", async () => {
  const ext = loadExtension(`<main>
    <section>
      <h2>教育经历</h2>
      <article class="card">${"<dl><dt>学校名称</dt><dd><input id='school0'></dd></dl>"}</article>
      <article class="card">${"<dl><dt>学校名称</dt><dd><input id='school1'></dd></dl>"}</article>
      <button type="button" id="add-edu">新增教育经历</button>
    </section>
  </main>`);
  try {
    ext.window.document.__addClicks = 0;
    ext.window.document.getElementById("add-edu").addEventListener("click", () => {
      ext.window.document.__addClicks += 1;
    });
    await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [
          { school: "First University" },
          { school: "Second University" },
        ],
      }),
      fillMode: "overwrite",
      scope: "page",
    });
    assert.equal(ext.window.document.getElementById("school0").value, "First University");
    assert.equal(ext.window.document.getElementById("school1").value, "Second University");
    assert.equal(ext.window.document.__addClicks, 0);
  } finally {
    ext.close();
  }
});

test("adjacent work add button is not used while advancing education", async () => {
  const ext = loadExtension(`<main>
    ${gatedMarkup}
    <section>
      <h2>工作经历</h2>
      <dl><dt>公司名称</dt><dd><input id="company"></dd></dl>
      <button type="button" id="add-work">新增工作经历</button>
    </section>
  </main>`);
  try {
    wireGatedAdd(ext.window.document);
    ext.window.document.__workAddClicks = 0;
    ext.window.document.getElementById("add-work").addEventListener("click", () => {
      ext.window.document.__workAddClicks += 1;
    });
    await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [
          { school: "First University" },
          { school: "Second University" },
        ],
        workExperiences: [{ company: "Example Tech" }],
      }),
      fillMode: "overwrite",
      scope: "page",
    });
    assert.equal(ext.window.document.__workAddClicks, 0);
    assert.equal(ext.window.document.getElementById("company").value, "Example Tech");
  } finally {
    ext.close();
  }
});

test("holdout English Done/Add another education uses save-then-add without submit", async () => {
  const ext = loadExtension(`<main>
    <fieldset aria-label="Education history">
      <div id="edu-editor">
        <label>School <input id="school"></label>
        <label>Start <input id="start"></label>
        <button type="button" id="save-edu">Done</button>
      </div>
      <div id="edu-cards"></div>
      <button type="button" id="add-edu" disabled>Add another education</button>
      <button type="submit" id="submit-app">Submit application</button>
    </fieldset>
  </main>`);
  try {
    const document = ext.window.document;
    const school = document.getElementById("school");
    const start = document.getElementById("start");
    const save = document.getElementById("save-edu");
    const add = document.getElementById("add-edu");
    const editor = document.getElementById("edu-editor");
    const cards = document.getElementById("edu-cards");
    document.__saveClicks = 0;
    document.__addClicks = 0;
    document.__submitClicks = 0;
    save.addEventListener("click", () => {
      if (!school.value.trim()) return;
      document.__saveClicks += 1;
      cards.insertAdjacentHTML(
        "beforeend",
        `<article class="saved-card"><strong>${school.value}</strong><span>${start.value}</span></article>`
      );
      school.value = "";
      start.value = "";
      editor.hidden = true;
      add.disabled = false;
    });
    add.addEventListener("click", () => {
      document.__addClicks += 1;
      editor.hidden = false;
      add.disabled = true;
    });
    document.getElementById("submit-app").addEventListener("click", () => {
      document.__submitClicks += 1;
    });
    await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [
          { school: "First University", startDate: "2020-09" },
          { school: "Second University", startDate: "2024-09" },
        ],
      }),
      fillMode: "overwrite",
      scope: "page",
    });
    assert.equal(document.__submitClicks, 0);
    assert.ok(document.__saveClicks >= 1);
    assert.equal(document.querySelector(".saved-card strong").textContent, "First University");
    assert.equal(school.value, "Second University");
  } finally {
    ext.close();
  }
});

test("work and internship add buttons stay inside their own sections", async () => {
  const ext = loadExtension(`<main>
    <section>
      <h2>实习经历</h2>
      <div class="card">
        <dl><dt>实习单位</dt><dd><input id="intern-company"></dd></dl>
      </div>
      <div id="intern-cards"></div>
      <button type="button" id="add-intern" disabled>新增实习经历</button>
    </section>
    <section>
      <h2>工作经历</h2>
      <div class="card">
        <dl><dt>公司名称</dt><dd><input id="work-company"></dd></dl>
      </div>
      <div id="work-cards"></div>
      <button type="button" id="add-work" disabled>新增工作经历</button>
      <button type="submit" id="submit-app">提交申请</button>
    </section>
  </main>`);
  try {
    const document = ext.window.document;
    document.__internAdd = 0;
    document.__workAdd = 0;
    document.__submitClicks = 0;
    const intern = document.getElementById("intern-company");
    const work = document.getElementById("work-company");
    const addIntern = document.getElementById("add-intern");
    const addWork = document.getElementById("add-work");
    intern.addEventListener("input", () => {
      addIntern.disabled = intern.value.trim().length < 2;
    });
    intern.addEventListener("change", () => {
      addIntern.disabled = intern.value.trim().length < 2;
    });
    work.addEventListener("input", () => {
      addWork.disabled = work.value.trim().length < 2;
    });
    work.addEventListener("change", () => {
      addWork.disabled = work.value.trim().length < 2;
    });
    addIntern.addEventListener("click", () => {
      document.__internAdd += 1;
      document.getElementById("intern-cards").insertAdjacentHTML(
        "beforeend",
        `<article class="saved-card"><strong>${intern.value}</strong></article>`
      );
      intern.value = "";
      addIntern.disabled = true;
    });
    addWork.addEventListener("click", () => {
      document.__workAdd += 1;
      document.getElementById("work-cards").insertAdjacentHTML(
        "beforeend",
        `<article class="saved-card"><strong>${work.value}</strong></article>`
      );
      work.value = "";
      addWork.disabled = true;
    });
    document.getElementById("submit-app").addEventListener("click", () => {
      document.__submitClicks += 1;
    });
    await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        internships: [
          { company: "First Intern Co" },
          { company: "Second Intern Co" },
        ],
        workExperiences: [
          { company: "First Employer" },
          { company: "Second Employer" },
        ],
      }),
      fillMode: "overwrite",
      scope: "page",
    });
    assert.equal(document.__submitClicks, 0);
    assert.equal(document.__internAdd, 1);
    assert.equal(document.__workAdd, 1);
    assert.equal(document.querySelector("#intern-cards .saved-card strong").textContent, "First Intern Co");
    assert.equal(document.querySelector("#work-cards .saved-card strong").textContent, "First Employer");
    assert.equal(intern.value, "Second Intern Co");
    assert.equal(work.value, "Second Employer");
  } finally {
    ext.close();
  }
});

test("blocked missing source data can resume without duplicating the first record", async () => {
  const ext = loadExtension(`<main>${gatedMarkup.replace(
    '<input id="start">',
    '<input id="start" required>'
  )}</main>`);
  try {
    wireGatedAdd(ext.window.document);
    const first = await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [{ school: "First University" }, { school: "Second University" }],
      }),
      fillMode: "overwrite",
      scope: "page",
    });
    assert.equal(ext.window.document.__addClicks, 0);
    assert.match(String(first.message || ""), /开始时间|必填/);
    await ext.request({
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [
          { school: "First University", startDate: "2020-09" },
          { school: "Second University", startDate: "2024-09" },
        ],
      }),
      fillMode: "incremental",
      scope: "page",
    });
    assert.equal(ext.window.document.__addClicks, 1);
    assert.equal(ext.window.document.querySelectorAll(".saved-card").length, 1);
    assert.equal(ext.window.document.getElementById("school").value, "Second University");
  } finally {
    ext.close();
  }
});

test("incremental rerun keeps saved cards and does not add a duplicate education row", async () => {
  const ext = loadExtension(`<main>${gatedMarkup}</main>`);
  try {
    wireGatedAdd(ext.window.document);
    const payload = {
      action: "startFill",
      modelId: "",
      resumeProfile: profileOf(ext, {
        educations: [
          { school: "First University", startDate: "2020-09" },
          { school: "Second University", startDate: "2024-09" },
        ],
      }),
      scope: "page",
    };
    await ext.request({ ...payload, fillMode: "overwrite" });
    const addClicks = ext.window.document.__addClicks;
    await ext.request({ ...payload, fillMode: "incremental" });
    assert.equal(ext.window.document.__addClicks, addClicks);
    assert.equal(ext.window.document.querySelectorAll(".saved-card").length, 1);
    assert.equal(ext.window.document.getElementById("school").value, "Second University");
  } finally {
    ext.close();
  }
});
