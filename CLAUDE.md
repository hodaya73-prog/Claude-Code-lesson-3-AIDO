# CLAUDE.md — read this before writing code

StudyPlanner: a dark-mode Hebrew/English student dashboard. Plain HTML/CSS/JS, no build step, no backend.

**Read first, in this order**

1. [`SPEC.md`](SPEC.md) — what the product does, and the decision log (D1–D28). A decision that is not there was not made.
2. [`architecture.md`](architecture.md) — how it is built, where each piece runs, the limits it lives with.
3. [`Practice.md`](Practice.md) — how we work (Hebrew): branches, pull requests, the test gate, what never goes into Git.
4. [`tests/README.md`](tests/README.md) and [`evals/README.md`](evals/README.md) — what proves nothing broke.

**Rules that matter most**

- **Never push to `master`.** Work on a branch (`feature/…`, `fix/…`, `design/…`, `spec/…`, `chore/…`), open a pull request, merge only when the
  `tests` check is green. `master` is protected, so a direct push is rejected anyway.
- **Run `tests/run.ps1` before you push** (about 20 s; the pre-push hook does it for you). If tests or evals fail, fix them — never skip the gate.
- **Fix a bug test-first:** write the failing check, see it fail, then fix.
- **Hebrew and English together.** A new UI string goes into both languages in `js/i18n.js` (`tests/i18n.test.js` fails otherwise).
- **Logic in `js/logic.js` / `js/sheets.js` with a test; `js/app.js` only wires data to the screen.**
- **A structural change updates the docs in the same pull request:** `architecture.md` (modules, stored keys, limits) and the SPEC decision log.
- **No personal data in the repository** — no real timetable, grades, teacher names, tokens or private sheet links.
- **No new dependency, build tool or framework without asking** (decision D26).
- **Report faithfully:** say what you did not test (for example anything that needs a live Google/Airtable/Apify service).

**Commands**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1     # dev server on http://localhost:5173
powershell -NoProfile -ExecutionPolicy Bypass -File tests/run.ps1       # tests + evals, exit code 1 on failure
git config core.hooksPath .githooks                                       # once per clone: enable the pre-push gate
```

**Commit messages:** English, imperative, under ~70 characters, no trailing full stop.
