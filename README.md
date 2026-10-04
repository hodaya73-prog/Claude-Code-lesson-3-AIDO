# StudyPlanner — student study-planner dashboard

A dark-mode, Hebrew/English dashboard that shows the next test countdown, today's school schedule and a short
"Today's Mission" list, and warns about every test one week ahead. It can read the schedule, tests and grades
from a Google Sheet. The full product spec is in [SPEC.md](SPEC.md).

This first build is **plain HTML/CSS/JS** (no install, no build step). It follows the spec's dashboard (§4) and
algorithms (§9).

## Live site

The site is published with GitHub Pages: **https://asafkakun.github.io/Claude-Code-lesson-3-AIDO/** — every `git push` to `master` updates it within about a minute. Google Sheet sources work there too (checked with the school's real published calendar).

## Run it

Needs nothing but Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
```

Then open <http://localhost:5173>. Open <http://localhost:5173/tests.html> to run the logic tests (they check the
worked examples from SPEC §9).

## What works

- **Main dashboard (SPEC §4):** 7-day notice banner (with test-cluster warning), next-test hero with live countdown
  and soft readiness status, today's schedule, Today's Mission (top 3 tasks, streak, weekly goal).
- **Header:** overall-average chip (opens the grades list), sync status + refresh, Google Sheet connection, HE/EN toggle
  (RTL flips automatically; Hebrew date shown by default in Hebrew).
- **Quick add "+":** local tests, hand-entered grades and a hand-entered timetable — saved on the device only and never written to a sheet.
- **Focus timer:** 25-minute session that logs study time (feeds readiness, streak and weekly goal).
- **Sample data** is built relative to today, so the dashboard always looks alive.

## Data sources

Click **מקורות נתונים / Data sources** in the header. Up to four sources can be connected at the same time; they are
merged, refreshed every 15 minutes and cached, so one failing source never hides the others.

| Source | What it gives | Link types |
|---|---|---|
| **School exam calendar** | Test dates for your grade | Published sheet (`…/d/e/2PACX…/pubhtml`) or a regular "anyone with the link" sheet |
| **Student grades sheet** | Grades and the averages | Same |
| **Personal sheet** | Timetable, tests and grades (tabs `Schedule`, `Exams`, `Grades`, optional `Subjects`, `Holidays`; see [`template/`](template)). **Any one of Schedule / Exams / Grades is enough**, so a sheet with only a `Schedule` tab works. Times may be `08:45` or Google-formatted `8:45:00 AM` | Same |
| **Timetable from Airtable** | Timetable only — an Airtable table with the `Schedule` columns (`weekday, period, start, end, subject, room, teacher, type, date, validFrom, validTo`) | The table address from the browser (`https://airtable.com/app…/tbl…`) plus a personal access token with `data.records:read` on that base |

**Timetable from Airtable.** The address of the school's `Schedule` table is built in (`DEFAULT_AIRTABLE` in `js/app.js`) and pre-filled, so a student only pastes the token, once per device. The token is saved only in this browser (never in the code or the repo) and is sent only
to `api.airtable.com`. Create it at airtable.com/create/tokens with the `data.records:read` scope and access to the one
base. A token looks like `patXXXXXXXXXXXXXX.<long secret>` — paste the whole thing, including the part after the dot.

**School exam calendar.** Paste the link; the app lists the tabs of the published sheet (for example one per grade) and
preselects the tab in the link. Rows look like `יום חמישי, 15/10/26, י״א - מבחן ספרות`. The app removes the grade prefix,
finds the subject in the text (Hebrew subject names, including specialty tracks) and the type (בוחן = quiz, מבחן = test,
מתכונת = mock exam, בגרות = bagrut, "מועד ב׳" = second sitting). The calendar has no time of day, so none is shown.


**Filtering the calendar to your subjects.** The school calendar lists every track of the grade, so once it is
connected the dialog shows *Which tests to show*:
- **Only my subjects (from my timetable)** — the default. A test is kept when its subject matches a subject in your
  timetable (spelling variants such as `הבעה ולשון` ↔ `לשון` are matched). **Exam blocks:** `גוש ב׳` covers the tracks software engineering (הנדסת תוכנה), biomedicine, biotechnology and computer science; every other track is `גוש א׳`. The app picks your block from the tracks in your timetable and shows only that block's tests. With no timetable nothing is hidden.
- **Choose subjects** — tick exactly the subjects you want; it starts from what is shown now.
- **All tests.**

The dialog shows how many tests are shown (e.g. 46 of 63) and which subjects are hidden. The choice is saved on the
device and applies to the banner, the next-test card and Today's Mission.

**Student grades sheet.** Needs a **subject** column (`מקצוע`) and a **grade** column (`ציון`); optional `תאריך` (date),
`כותרת`/`מבחן` (title) and `משקל` (weight, default 1). Title rows above the header are skipped, empty grades are ignored,
`87,5` is read as 87.5, and subject names like `ספרות 5 יח"ל` are matched to the calendar's `ספרות`. Rows that cannot be
read are listed with their real row number.

> **Privacy:** prototype mode reads sheets through their public link, so anyone with the link can see them. The school
> calendar is public by design, but use **test data only** for grades until Google sign-in (SPEC decision D19) is added.
> Tested against the school's real published calendar; the grades-only source and the personal sheet were tested only
> with mocked Google responses.

## Enter data by hand (no file needed)

The **+** button opens a menu:

- **Add a task for today** — what to do, an optional subject and minutes (5–240). It appears in Today's Mission under the suggested tasks (also via the ＋ on that card). Ticking it logs the minutes (streak and weekly goal); ✕ removes it. Tasks from earlier days are dropped automatically.
- **Add a grade** — subject, grade (0–100, `87,5` is fine) and date; title is optional. There is **no weight field**:
  every hand-entered grade counts as 1. Entered grades are listed in the grades dialog (tap the average chip) where
  each one can be deleted.
- **Add lessons** — subject, start/end time, optional room, and **one or several weekdays at once**. Lessons are numbered
  by start time, shown in "Today's schedule", and used for free-study-time. The timetable dialog (✎ on the schedule card)
  lists and deletes hand-entered lessons.
- **Import a timetable file** — in the timetable dialog (✎ on the schedule card): choose a CSV with the columns `weekday, period, start, end, subject, room, teacher` (`weekday` 1 = Sunday; see [`template/Schedule.csv`](template/Schedule.csv)). UTF-8 or Excel Hebrew (windows-1255) files, with `,` `;` or tab separators, are accepted. Importing again replaces the previously imported lessons; lessons added by hand stay. Rows that cannot be read are listed with their row number.
- **Add a test** — local test, as before.

Hand-entered data is saved on this device only and is merged with any connected sheets. As soon as something is entered
by hand, the built-in sample data is no longer shown.

## Study videos screen (Apify)

The **🎬 סרטוני לימוד / Study videos** chip in the header opens a second screen (`#videos`; the chip becomes
**🏠 Dashboard** to go back). It uses [Apify](https://www.apify.com) to find the most-watched YouTube explanations for
the subject of your next test:

1. Create a free Apify account, open **Settings → API & Integrations** and copy the personal API token.
2. Paste it on the screen and press **Save token**. It is stored only in this browser and sent only to `api.apify.com`.
3. Pick a subject (the next test's subject is preselected ★), optionally add a topic, press **Find videos**.

Behind the button the page calls the public actor [`streamers/youtube-scraper`](https://apify.com/streamers/youtube-scraper)
through `run-sync-get-dataset-items` with `{ searchQueries: ["<subject> <topic> <lesson explained>"], maxResults: 8 }`,
drops duplicates and non-`https` links, sorts by views, and shows thumbnail, channel, length, date and view count plus
three totals. Results are cached on the device per query (last 12), so they stay visible offline; a search only runs when
the button is pressed because each run uses a little of the student's Apify credit. **Show demo videos** displays four
clearly-marked example rows with no token. Errors are explained (token rejected, no credit, timeout).
Not available in the hosted Artifact preview (network blocked). Logic lives in `js/apify.js`; tests are in `tests.html`.

> Tested with mocked Apify responses (request shape, parsing, errors); the live Apify call was **not** tested with a
> real account. The CORS preflight of `api.apify.com` was checked and allows the `Authorization` header from any origin.

## Not built yet

Calendar, Exams, Grades and Settings pages, exam-calendar filtering by class/track, bagrut tracker, push/email notifications, simple mode, real Google
sign-in. See the roadmap in SPEC §12.

## Files

| Path | Purpose |
|---|---|
| `index.html`, `css/styles.css` | Page and dark theme (design tokens from SPEC §6) |
| `js/logic.js` | Pure logic: readiness, countdown, cluster, grades, mission, streak (SPEC §9) |
| `js/sheets.js` | CSV parsing, validation, Google Sheet reading (SPEC §8.1, §9.7) |
| `js/apify.js` | Study videos screen: Apify YouTube search, parsing, formatting |
| `js/sample.js` | Sample data relative to today |
| `js/i18n.js` | Hebrew/English strings |
| `js/app.js` | Rendering and events |
| `tests.html` | Browser-run tests |
| `tools/serve.ps1` | Static dev server without Node/Python |

## Hosted preview (Claude Artifact)

`tools/build-artifact.ps1` builds `dist/artifact.html` (git-ignored): the whole site inlined into one HTML file that
can be published as a private Claude Artifact. The hosted page blocks network requests, so **Google Sheet sources do not
work there** (the dialog says so); sample data, hand-entered lessons/grades/tasks and timetable-file import do.
