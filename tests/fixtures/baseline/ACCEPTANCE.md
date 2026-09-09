# Reliability acceptance record

Date: 2026-09-07 (Asia/Shanghai)

## Frozen fixture set

- File: `tests/fixtures/baseline/cases.json`
- SHA-256: `A5FA70D10474FB60FD03B1D8A66F7C139CE4FC1650AE62D474EA05482548D534`
- Development layouts: L1 semantic identifier, L2 native associated
  labels, L3 repeated cards out of order
- Regression layout: H1 accessible project region
- Unseen holdouts after the H1 fix: H2 random internship container and
  H3 accessible publication group
- Data: fictional only

All six fixtures pass scan, deterministic mapping, fill, and final DOM value
checks. The H1 fixture initially exposed an unmapped bare `Responsibilities`
label inside a locked project section. It became a regression fixture after
the section-constrained project-role rule was fixed; H3 was added as a new
unseen holdout.

## Repeat-record coordinator

Handshake: `2026-09-07-repeat-flow-v16`. Production `startFill` now fills
education, internship, work, and project records one at a time. Tests use
fictional resumes and production coordinator code.

- Gated add: first education must be accepted before the second editor appears
- Save-then-add: Add is not clicked while Save is the required next action
- Add-that-validates: stays on the current record when required data is missing
- English holdout: fieldset `Education history` with `Done` / `Add another education`
- Adjacent work Add is ignored while advancing education
- Incremental rerun does not duplicate saved cards

## Browser smoke

- Chrome: current session, `structural-smoke.html`
- Extension: `1.3.0`
- Content script: `2026-09-07-repeat-flow-v16`
- First run: 12 fields filled, 0 failures
- Incremental run: 12 preserved, 0 written
- Handshake v16
- `tests/browser/repeat-flow-smoke.html` is available for gated-add education;
  this session's local `:8765` server was an older allowlist and returned an
  empty page for that route. Gated-add and English holdout were instead
  verified through unpacked-extension E2E.

The smoke pages directly load the production content script. They are browser
evidence, but not extension integration evidence.

## Unpacked-extension E2E

`npm run test:e2e` passes six Playwright tests using system Chrome and a real
unpacked MV3 extension:

1. service worker startup and `chrome.storage.local` round trip;
2. popup injection list and `chrome.scripting` execution, including `repeat-flow.js`;
3. `startFill` response, final DOM values, v16 handshake, zero submissions,
   and zero model requests;
4. gated education: first record is saved as a card before the second editor
   is filled; `提交申请` is never clicked;
5. holdout English education: `Done` then `Add another education`;
   `Submit application` is never clicked;
6. independent loading of the same `popup.html` source.

Chrome Side Panel WebContents are not enumerable by Playwright. The E2E covers
the popup source, service worker, injection, content script, storage, and
target page, but records the Side Panel container itself as a manual boundary.

## Node regression

`node --test` after the repeat-flow coordinator: 216 passed, 0 failed. This
still does not prove recruiting-website compatibility.

## China Mobile campus resume (access attempt)

Date: 2026-09-07 (Asia/Shanghai). Target:
`https://job.10086.cn/personal/resume_campus.html`.

The page redirected to `https://job.10086.cn/login.html` (SMS code and
image captcha). No content-script injection, fill, save, or submit was
performed. This is recorded as **untested**, not as a pass or fail of the
coordinator.

Public touch edit templates exposed labels only (not interactive DOM after
login):

- Publications / 专业论著: `edit_treatise.html` — presence flag, title,
  abstract, achievement/level, date, author order, conference status,
  sole/co-author.
- Projects / 项目经历: `edit_project.html` — presence flag, name, company,
  role, date range, duties, description.
- Campus posts / 校内职务: `edit_schoolPost.html` — dates, organization,
  role, cadre level, duties and achievements.

Those labels must not be treated as a completed site acceptance. Login is
still required before measuring scan, mapping, serial advance, or
incremental preserve on this host.

## Evidence boundary

These results do not prove compatibility with a recruiting website, cross-
origin iframe, closed shadow root, or portal-based asynchronous picker.
The China Mobile campus resume page was opened but blocked by login; it
remains untested for fill. Such cases remain explicit ROADMAP work and must
not be reported as passed.
