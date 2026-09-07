const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const semantics = require("../shared/field-semantics.js");

function loadResumeSchema() {
  const source = fs.readFileSync(
    path.join(__dirname, "../shared/resume-schema.js"),
    "utf8"
  );
  const context = {
    window: {},
    console,
    structuredClone: global.structuredClone,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.ResumeSchema;
}

test("canonical schema labels keep deterministic semantic mappings", () => {
  const schema = loadResumeSchema();
  const catalog = schema.getFieldCatalog({ mode: "max" });
  const validPaths = new Set(catalog.map((field) => field.path));
  const sectionMap = {
    personal: "personal",
    contactAndLocation: "personal",
    identityAndAuthorization: "personal",
    applicationDeclarations: "personal",
    onlinePresence: "personal",
    jobPreferences: "jobPreference",
    skills: "skill",
    educations: "education",
    internships: "internship",
    workExperiences: "work",
    projects: "project",
    campusExperiences: "campus",
    certificates: "certificate",
    languages: "language",
    awards: "award",
    patents: "patent",
    publications: "publication",
  };

  const covered = catalog.filter((field) => {
    if (!sectionMap[field.sectionKey]) return false;
    if (/\.\d+\./.test(field.path) && !field.path.includes(".0.")) return false;
    return true;
  });

  const failures = [];
  for (const field of covered) {
    const expectedPath =
      field.path === "personal.highestEducationLevel"
        ? "derived.highestEducation.degree"
        : field.path;
    const actualPath = semantics.resolvePreferredResumePath(
      {
        sectionKey: sectionMap[field.sectionKey],
        sectionItemIndex: field.path.includes(".0.") ? 0 : undefined,
        kind: field.input === "select" ? "select" : "text",
        inputType: field.input,
        label: field.label,
        options: field.options,
      },
      "",
      validPaths
    );
    if (actualPath !== expectedPath) {
      failures.push(`${field.label}: ${actualPath || "(empty)"} != ${expectedPath}`);
    } else if (
      !semantics.isResumePathCompatibleWithField(
        {
          sectionKey: sectionMap[field.sectionKey],
          sectionItemIndex: field.path.includes(".0.") ? 0 : undefined,
          kind: field.input === "select" ? "select" : "text",
          inputType: field.input,
          label: field.label,
          options: field.options,
        },
        actualPath
      )
    ) {
      failures.push(`${field.label}: ${actualPath} was rejected by compatibility guard`);
    }
  }

  assert.deepEqual(failures, []);
});

test("high-risk nested identity and contact labels cannot fall back to personal data", () => {
  const validPaths = new Set([
    "personal.fullName",
    "personal.phoneNumber",
    "contactAndLocation.emergencyContactName",
    "contactAndLocation.emergencyContactPhone",
    "identityAndAuthorization.passportName",
  ]);

  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "紧急联系人姓名" },
      "personal.fullName",
      validPaths
    ),
    "contactAndLocation.emergencyContactName"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", inputType: "tel", label: "紧急联系人电话" },
      "personal.phoneNumber",
      validPaths
    ),
    "contactAndLocation.emergencyContactPhone"
  );
  assert.equal(
    semantics.resolvePreferredResumePath(
      { sectionKey: "personal", label: "护照姓名" },
      "personal.fullName",
      validPaths
    ),
    "identityAndAuthorization.passportName"
  );
});
