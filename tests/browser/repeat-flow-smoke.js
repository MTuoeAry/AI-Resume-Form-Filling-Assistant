(() => {
  let listener;
  const cache = {};
  window.chrome = {
    runtime: {
      onMessage: { addListener(fn) { listener = fn; } },
      sendMessage(message, callback) {
        if (message.action === "callAI") callback({ success: false, error: "模型已禁用" });
      },
    },
    storage: { local: { async get() { return cache; }, async set(value) { Object.assign(cache, value); } } },
  };

  const school = document.getElementById("school");
  const start = document.getElementById("start");
  const add = document.getElementById("add-edu");
  const cards = document.getElementById("edu-cards");
  window.__addClicks = 0;
  window.__submitClicks = 0;
  const sync = () => {
    add.disabled = String(school.value || "").trim().length < 2;
  };
  school.addEventListener("input", sync);
  school.addEventListener("change", sync);
  add.addEventListener("click", () => {
    if (add.disabled) return;
    window.__addClicks += 1;
    const card = document.createElement("article");
    card.className = "saved-card";
    card.innerHTML = `<strong>${school.value}</strong><span>${start.value || ""}</span>`;
    cards.append(card);
    school.value = "";
    start.value = "";
    sync();
  });
  document.getElementById("submit-app").addEventListener("click", () => {
    window.__submitClicks += 1;
  });
  sync();

  const request = (message) => new Promise((resolve) => listener(message, {}, resolve));
  document.getElementById("run").addEventListener("click", async () => {
    const output = document.getElementById("result");
    output.textContent = "运行中";
    const profile = window.ResumeSchema.normalizeResumeProfile({
      educations: [
        { school: "First University", startDate: "2020-09" },
        { school: "Second University", startDate: "2024-09" },
      ],
    });
    const result = await request({
      action: "startFill",
      modelId: "",
      resumeProfile: profile,
      fillMode: "overwrite",
      scope: "page",
    });
    const values = {
      firstCard: document.querySelector(".saved-card strong")?.textContent || "",
      editor: school.value,
      addClicks: window.__addClicks,
      submitClicks: window.__submitClicks,
      handshake: window.ResumeContentBridge?.CONTENT_SCRIPT_VERSION || "",
    };
    const passed =
      result.success === true &&
      values.firstCard === "First University" &&
      values.editor === "Second University" &&
      values.addClicks === 1 &&
      values.submitClicks === 0 &&
      values.handshake === window.ResumeContentBridge.CONTENT_SCRIPT_VERSION;
    output.textContent = JSON.stringify({ passed, result, values }, null, 2);
    output.dataset.passed = String(passed);
  });
})();
