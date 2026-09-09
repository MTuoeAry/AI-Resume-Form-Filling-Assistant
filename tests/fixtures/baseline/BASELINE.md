# Reliability baseline

Captured: 2026-09-07 (Asia/Shanghai)

## Runtime

- Git HEAD: `c0421eeff2eb5b817fa2dfcca0896e126f01f0b9`
- Branch at capture: `master`
- Node.js: `v22.12.0`
- npm: `10.9.0`
- Chrome: `152.0.7977.76`
- Extension: `1.3.0`
- Resume schema: `11`
- Mapping cache: `fieldMappingCacheV15`
- Content script: `2026-09-09-mapping-policy-v21`

## Working tree

The baseline was captured on top of the existing uncommitted v15 structural
engine work. At capture time Git reported 16 modified files, one deleted image,
and seven untracked paths. Do not attribute that pre-existing work to later
reliability stages; use `git diff` for the exact current state.

## Automated result

`npm test` completed with 171 tests passed, 0 failed, 0 skipped, and 0
cancelled. This proves the Node/jsdom layer only. It does not prove the browser
smoke test, the unpacked-extension message chain, or any recruiting website.

The ignored `tmp/structural-tests.log` contains the older v14 170-test run and
is intentionally not current evidence.
