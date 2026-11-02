# tests/

Checks that prove nothing broke. They run in a **headless Chrome/Edge** (decision D27), because the code reads
`window`/`document` and two checks (contrast, phone layout) need a real browser engine.

## Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests/run.ps1     # tests/ and evals/, about 20 seconds
```

Exit code `0` = everything passed, `1` = something failed (the failing checks are printed). Needs Chrome or Edge.
To look at the results yourself, start `tools/serve.ps1` and open <http://localhost:5173/tests/>; the tab title is
`PASSED <n>` when everything passes.

The same script is used three times — that is the point:

| Where | How | Stops what |
|---|---|---|
| Your laptop | `tests/run.ps1` | You, before you push |
| `git push` | `.githooks/pre-push` (enable once per clone: `git config core.hooksPath .githooks`) | A push with failing tests |
| GitHub | `.github/workflows/test.yml`, required on `master` | A merge with failing tests |

## What is covered

| File | Covers |
|---|---|
| `logic.test.js` | `js/logic.js`: readiness, countdown, 7-day notice, clusters, grade average and trend, Today's Mission, streak, tests-list filters |
| `sheets.test.js` | `js/sheets.js`: CSV, dates and times, links, the school-calendar parser (including second sittings and unknown subjects), grades and timetable parsers, exam blocks |
| `apify.test.js` | `js/apify.js`: query, normalising results, unsafe links, counts |
| `sample.test.js` | the demo data is valid in both languages |
| `i18n.test.js` | Hebrew and English strings stay in step (same keys, same `{placeholders}`), plural/duration helpers |
| `design.test.js` | WCAG AA contrast of the real colour tokens in `css/styles.css`; the real page does not scroll sideways in a 375 px frame |

**Not covered:** the rendering code in `js/app.js` beyond the phone-layout check — screens, dialogs and events are verified by hand
(see `Practice.md` §4). Network loaders (`loadAirtable`, `loadSingleTab`, the Apify call) are not tested because they need a live service.

## Adding a test

1. Put it in the file for the module you changed, as `check('what it proves', actual, expected)`.
2. Write the **failing** test first when you fix a bug, and watch it fail for the right reason.
3. Numbers compare with a tolerance, everything else is compared as JSON.
4. A check that needs the network or an iframe registers its promise with `later(...)`; `harness.js` waits for it.

`harness.js` is the whole framework (about 30 lines). Test files share one global scope in the order listed in `index.html`:
`logic.test.js` defines helpers (`monday`, `mkExam`, `settings`) that later files reuse.
