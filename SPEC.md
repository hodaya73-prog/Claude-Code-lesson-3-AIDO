# SPEC — Student Study-Planner Dashboard

A dark-mode web dashboard that helps students manage tests, exams and bagruts, and plan their study time by showing test dates, countdowns and how much study time is left. It is built around the school timetable, fed from Google Sheets, and turns grades into clear averages and insights.

- **Status:** Draft v0.4 (open questions closed: decision log D1–D19 resolved or consciously deferred; minimal phone-first dashboard; bagrut 70/30 default; `spreadsheets.readonly` scope)
- **Languages:** Hebrew (RTL) and English (LTR), switchable at runtime
- **Theme:** Dark mode (primary and only theme in v1)

---

## 1. Overview & Goals

### 1.1 Problem
Students juggle many tests, quizzes, exams and (later) bagrut exams with dates spread across subjects. They usually notice a deadline too late and do not know how much study time they actually have left, so they cram or under-prepare. Grades sit in a separate place, so they also cannot see which subjects need attention.

### 1.2 Purpose
A single dashboard, **built around the student's school schedule and fed from Google Sheets**, that answers at a glance:
1. **What is coming up?** (next tests/exams, sorted by date — always announced **one week ahead**)
2. **How long do I have?** (live countdown)
3. **Am I ready?** (study time planned/logged vs. study time needed)
4. **What should I do today?** (today's lessons from the school schedule + a short "Today's Mission" list)
5. **How am I doing?** (average grade per subject and overall, trends and predictions)

### 1.2.1 Core ideas
1. **School-schedule-based:** the weekly timetable is the backbone of the dashboard. It shows today's lessons, links each test to its lesson slot, and defines when the student is free to study.
2. **One-week notice:** every test gets an automatic notice **7 days before** it, no matter how it was added.
3. **Google Sheets as the data source:** schedule, tests and grades are read from Google Sheets. No manual re-typing; the sheet is the source of truth.
4. **Grades & averages:** grades are read from the sheet and the average is calculated for every subject (and overall).
5. **Insight, not just data:** the app points out weak subjects, tests bunched together, and what grade is needed to reach a goal.

### 1.2.2 Product principles
- **The sheet is the truth.** The app never overwrites it; anything the app adds itself is clearly marked "local".
- **Never nag twice.** One well-timed notice beats many. The 7-day notice is mandatory; everything else is optional and can be quiet.
- **Always explain a number.** Every average, score or prediction can be tapped to show how it was calculated.
- **Calm and encouraging.** Dark, low-glare UI; streaks pause instead of "breaking"; no shaming for low grades.
- **Hebrew and English are equals.** Same features, same quality, correct direction, gender-neutral Hebrew copy.

### 1.3 Success criteria
- A new student can connect a sheet and see their first countdown in under **2 minutes** (under **60 seconds** for adding a first exam by hand).
- The dashboard gently flags any exam where the student needs a boost on study time, always with a small next step (§4.3).
- The main dashboard shows only **3 main widgets** (next test, today's schedule, Today's Mission) plus the 7-day banner, and is fully usable one-handed on a phone.
- **100% of tests found in the sheet get a 7-day notice**, including tests added to the sheet less than 7 days ahead (notice fires on the next sync). The notice is delivered through at least one guaranteed channel (see §10.2): in-app banner and/or email.
- Changes made in Google Sheets appear on the dashboard within **15 minutes** while the app is open (or immediately on manual refresh).
- The per-subject average shown matches a manual calculation from the same sheet rows.
- All screens are usable in both Hebrew (RTL) and English (LTR) with no layout breakage.
- Text/background contrast meets **WCAG AA** in dark mode.

### 1.4 Non-goals (v1)
- Not a full school management system (no attendance or teacher tools). Grades are **read-only and displayed**, not managed here.
- **Read-only from Google Sheets in v1:** the website never writes back to the sheet.
- No social/multi-student features; no shared class sheets (privacy, see Decision D8).
- No light theme.
- No AI tutoring or content delivery.
- No official Ministry of Education integration in v1 (dates and grades come from the student's sheet).

---

## 2. Target Users

**Primary:** students in **middle school and above** (approx. ages 12–18+), including students preparing for **bagrut** exams. Younger students are possible but not designed for.

| Persona | Age | Needs | Design implication |
|---|---|---|---|
| **Middle schooler** (grades 7–9, ז–ט) | 12–15 | Simple view of upcoming tests; friendly reminders; low setup effort | Simple defaults, playful but not childish tone, few required fields, **simple mode** (bagrut tracker, predictions and readiness score hidden, §4.2) |
| **High schooler** (grades 10–11, י–יא) | 15–17 | Many subjects, overlapping tests, planning ahead | Calendar view, per-subject readiness, plan generator, test-cluster warnings |
| **Bagrut-year student** (grade 12, יב) | 17–19 | High-stakes exams, large syllabi, moed A/B, weighted subjects (units/יחידות) | Bagrut tracker, topic-level progress, readiness score, predicted final grade |

Secondary (later): parents viewing a read-only summary; teachers who maintain the class template.

Priority key used in this document: **P0** = must be in v1, **P1** = should be in v1 if time allows, **P2** = later.

---

## 3. Features

### 3.1 MVP (v1)

#### F0. Google Sheets data source (P0)
- The student (or parent/teacher) connects **one Google Spreadsheet** by signing in with Google (read-only `spreadsheets.readonly` scope, Decision D19) and pasting the sheet's link or ID (see §10.1).
- The app reads these tabs (exact columns in §8.1): **Schedule**, **Exams**, **Grades**, and optionally **Subjects**, **Topics**, **Holidays**.
- **Sync:** on app open, then every 15 minutes while open, plus a manual "Refresh" button. Last-sync time is shown in the header.
- **Validation:** rows with a bad date, unknown subject or non-numeric grade are skipped and listed in a "Sync issues" panel with the row number, so the student knows what to fix in the sheet.
- **Offline:** the last successful sync is cached and shown with an "offline / last updated" label.
- **Read-only:** the site never edits the sheet. Tests or grades added by hand in the app (optional) are stored locally and marked as "local".
- A **template spreadsheet** is provided so students can start with the correct tabs and headers, including an optional Apps Script for email notices (§10.2).
- **Calendar filter:** the school calendar lists every track of the grade, so its tests are limited to the subjects of the student's timetable by default (spelling variants matched); the student can choose subjects by hand or show all (Decision D24).
- **Up to three sources are merged** (Decision D20): (1) the **personal sheet** described above; (2) the **school's official exam calendar**, a published sheet with one tab per grade and the columns *day, date, exam text* — the app lists the tabs, the student picks their grade, and the subject, type (quiz / test / mock / bagrut, moed B) are read from the exam text; (3) a **grades-only sheet** with a subject column and a grade column (optional date, title, weight). Each source is synced and cached on its own, so one failing source never hides the others. Published links (`/d/e/2PACX…/pubhtml`) and regular "anyone with the link" links are both accepted.

#### F0.1. School schedule (timetable) (P0)
- Shows the weekly timetable (day, lesson number/time, subject, room, teacher) from the **Schedule** tab.
- The dashboard's **Today** widget lists today's lessons in order, highlights the current/next lesson, and shows the tests that fall on that day.
- Each test is matched to its lesson slot by subject + date, so the calendar shows "Math test — period 3".
- **Free time is derived from the schedule:** hours outside lessons (after school, free periods, days off) become the student's default study availability (replaces most manual availability entry; manual blocked time still works on top).
- **Personal sheet with any single tab:** at least one of Schedule / Exams / Grades is enough; times in 24h or am/pm are read.
- **Timetable file import:** a CSV with the Schedule-tab columns can be uploaded in the app (UTF-8 or Excel-Hebrew encoding; `,` `;` or tab); re-importing replaces the previous import (Decision D22).
- **Own tasks for today:** the student can add a task for today (title, optional subject, minutes); it is listed in Today's Mission below the suggested tasks, counts for the streak and weekly goal when ticked, and expires at the end of the day (Decision D23).
- **Manual timetable (no file needed):** the student can add lessons by hand — subject, start/end, optional room, one or several weekdays at once; periods are numbered by start time. Stored on the device, merged with any sheet schedule.
- Holidays / days off come from the **Holidays** tab or from a `Schedule` row with `type = off`. One-off changes (substitute lesson, cancelled lesson) are Schedule rows with a specific `date`.

#### F1. Exams & tests manager (P0)
- Tests are **loaded from the Exams tab** of the sheet (subject, title, **type**, date & time, weight, topics, notes).
- **Quick add (P0):** the dashboard "+" button adds a **local test** (subject, title, type, date, time) for students who don't want to edit the sheet. Local tests are tagged "Local", stored only on the device, **never written to the sheet**, and get the same countdown, plan and mandatory 7-day notice as sheet tests.
  - **Duplicate handling:** when a later sync brings a sheet test with the same subject and date (and a similar title), the sheet test replaces the local one and the student sees a small "Now synced from your sheet" note.
  - Local tests can be edited or deleted in the app; sheet tests cannot (the sheet is the source of truth).
- **Exam types:** quiz (בוחן), test (מבחן), exam (בחינה), project deadline, bagrut (בגרות) with moed A / moed B.
- Exams sorted by date; past exams move to a "Done" archive with an optional score and a short reflection (§3.3).

#### F2. Live countdown (P0)
- Every upcoming exam shows time left as **days · hours · minutes** (minutes only within the final 24h).
- Countdown color follows urgency (see Design System §6.4).

#### F3. Study-time-left calculator (P0)
- For each exam computes:
  - **Time available** = study hours the student has free between now and the exam (from the school schedule and manual blocks).
  - **Time needed** = recommended study hours (from weight, difficulty, and number of topics).
  - **Time logged** = hours already studied.
- Shows a soft **readiness status:** *On track* / *A bit tight* / *Needs a boost* (wording and tone in §4.3), plus the number of minutes to add per day as a gentle suggestion.
- Formula details in §9.

#### F4. Reminders & notifications (P0)
- **One-week notice (mandatory):** for **every** test, quiz, exam and bagrut, the student is notified **7 days before** the test date. This notice is on by default and **cannot be turned off per test** (the student may change only its channel and the time of day, default 16:00).
  - Message example: "Math test in 7 days (Sun 28 Sep, period 3). Start planning — you have ~9h of free study time."
  - The notice shows the study-time-left result (F3) so it is actionable.
  - If a test is added or moved so that it is **less than 7 days away**, the notice fires immediately on the next sync (once per test).
  - If the test date moves, the 7-day notice is recomputed and re-sent once.
  - Deduplicated: one 7-day notice per test, even if several tests fall on the same day (they are grouped into a single notification).
- Additional configurable lead times per exam, defaults: **3 days, 1 day, morning of, 1 hour before** (7 days is always included).
- Channels (see §10.2 for reliability of each): **in-app banner** (always), **email via the template's Apps Script** (opt-in, works with the app closed), **Web Push** (opt-in, best effort).
- Daily "today's plan" reminder at a user-chosen time.
- Quiet hours (no notifications at night; default 21:30–07:00).
- **Notification center** (P1): a list of every notice sent, so nothing is lost if a push is missed.
- **Weekly digest** (P1, optional): Sunday morning summary of the week's tests, load and goals.

#### F5. Study plan generator (P0)
- Splits an exam's topics across the available days before the test.
- Respects blocked days (other exams, activities) and the student's daily study cap.
- Produces **tasks** ("Chapter 4 – Trigonometry, 45 min") the student can check off, move, or regenerate.
- Auto-rebalances when a task is missed or the exam date changes.
- Adds **spaced-revision tasks** (+1, +3, +7 days after a topic is completed) when time allows (§9.15).

#### F6. Subjects (P0)
- Subjects come from the sheet, with a color and (for bagrut subjects) the number of units (יחידות).
- Subject color is used consistently across the calendar, cards and charts.

#### F7. Calendar (P1)
- Week and month views showing lessons, exams, study tasks and blocked time.
- Drag a study task to another day to reschedule.
- Optional **workload heat map** overlay showing how heavy each week is (§9.13).

#### F8. Study session logging (P0)
- Start/stop a timer or add a manual entry (subject, topic, duration).
- Logged time feeds the readiness calculation, the streak and the weekly goal.

#### F8.1. Grades & averages (P0)
- Grades are loaded from the **Grades** tab (subject, grade, date, weight, title/type).
- **Per-subject average** is calculated for every subject and shown as a card with: average, number of grades, trend arrow (§9.10), and lowest/highest grade.
- **Overall average** across all subjects; for bagrut subjects, optionally weighted by units (יחידות).
- **Weighting:** if a `weight` column is filled, a weighted average is used; if empty, all grades count equally (see §9.6).
- **Grade scale:** 0–100 by default (Israeli standard); configurable per sheet (e.g., 1–10; letter grades are out of scope for v1).
- **Grade history:** tap a subject to see a line chart of grades over time and the list of grades.
- **"What do I need?" helper:** the student sets a target average per subject and sees the grade needed on the next test to reach it.
- Grade colors: ≥ 85 `--ok`, 55–84 neutral/`--primary`, < 55 `--urgent` (always with a number, never color alone). Passing threshold configurable per subject (default **55**; see §7.1).
- Subjects with no grades yet show "No grades yet" instead of 0.
- **Manual grade entry (no weight):** the student can add a grade by hand — subject, grade (0–100), date, optional title. The form never asks for a weight; hand-entered grades always count as 1 (Decision D21). Stored on the device and can be deleted.

#### F9. Settings (P0)
- Language toggle (Hebrew / English), notification settings and channels, **Google Sheets connection**, weekly availability (auto-derived from the school schedule, editable), daily study cap, weekly study goal, week start day and school days (Sunday default; Friday configurable as school/short/off), grade scale, pass mark and target averages, backup export/import.

### 3.2 Later (post-v1, P2)
- Email/WhatsApp reminders beyond the Apps Script email.
- Import from Google Calendar / iCal; export study plan to calendar.
- Shared class calendar (one student adds a test, classmates get it) — needs a backend and a privacy review.
- Parent read-only view.
- Topic templates for common bagrut subjects (maintained content; see Decision D1).
- Light theme.

### 3.3 Expanded student features

| # | Feature | Priority | What it does |
|---|---|---|---|
| S1 | **Today's Mission** | P0 | The top **3 tasks** for today, chosen automatically by urgency × subject weakness × topic confidence (§9.14). A single, finishable list instead of a long plan. Completing all three shows a small celebration and counts for the streak. |
| S2 | **Test-cluster warning** | P0 | Detects tests bunched together (e.g., 3 tests in 4 days) and shows "start by <date>" with the workload (§9.13). Appears on the dashboard and in the 7-day notice. |
| S3 | **Exam prep checklist** | P1 | Per exam: topics to tick off, plus a "what to bring" checklist (calculator, formula sheet, ID for bagrut). Checklist items are local. |
| S4 | **Post-exam reflection** | P1 | After the test date passes: "How did it go?" — expected score, how prepared felt, one thing to do differently. When the real grade appears in the sheet, the app compares it with the expectation (private, never shared). |
| S5 | **Topic confidence rating** | P1 | Student rates each topic 1–5. Low-confidence topics get more time in the plan and rank higher in Today's Mission. |
| S6 | **Spaced revision** | P1 | Auto-adds short revision tasks +1, +3 and +7 days after finishing a topic, if before the exam (§9.15). |
| S7 | **Streaks & weekly goal** | P1 | A day counts when the student logs ≥ 20 min or finishes a Mission task. One automatic "freeze" per week. Streaks **pause** rather than "break"; wording stays encouraging (§9.15). Weekly goal default 5 h, configurable. |
| S8 | **Focus timer** | P1 | Pomodoro 25/5 (configurable) tied to the study log; screen-friendly full-screen mode; optional chime. |
| S9 | **Catch-up mode** | P1 | After ≥ 2 missed days or a "Needs a boost" status, offers a lighter re-plan ("Keep it small: 3 × 20 min today"). |
| S10 | **Achievements** | P2 | Quiet badges (first week streak, all Mission tasks done, grade improvement) — never tied to grade values alone. |
| S11 | **Quiet mode** | P1 | One toggle that silences everything except the mandatory 7-day notice for the next 24 h (e.g., during a holiday). |

### 3.4 Smarter analytics

| # | Insight | Priority | Rule (details and worked examples in §9) |
|---|---|---|---|
| A1 | **Weak-subject detection** | P0 | A subject is flagged when its average is below 70, its recent trend is falling, or it is more than 5 points below the student's target (§9.9). |
| A2 | **Grade trend** | P0 | Rising / stable / falling from a regression slope over the last up to 5 grades; needs ≥ 3 grades (§9.10). |
| A3 | **Predicted final grade** | P1 | A **range** (low–high), not a single number, shown only when the sheet provides how much grade weight remains (§9.11). |
| A4 | **Bagrut readiness score** | P1 | 0–100 per bagrut subject from current average, study time done vs needed, and topic coverage, with the breakdown visible (§9.12). |
| A5 | **What-if calculator** | P1 | "If I get X on the next test, my average becomes Y" and "What do I need to reach my target?" (extends §9.6). For bagrut: the exam grade needed to reach a target final grade (§9.8). |
| A6 | **Workload heat map** | P1 | Test density per week; highlights heavy weeks early (§9.13). |
| A7 | **Study-vs-grade insight** | P2 | Shown only with ≥ 5 (study hours, grade) pairs. Labeled as a *pattern*, never as cause; can be hidden in Settings. |
| A8 | **Bagrut average** | P1 | Average across bagrut subjects weighted by units (§9.8). |

A3, A4, A5 (what-if slider) and A8 are **hidden in simple mode** (grades 7–9, §4.2); A1, A2, A6 and the basic "grade needed for my target" stay available to everyone.

Guardrails for analytics: always show the number of grades used; never show a prediction or trend with too little data; no comparisons with other students; low-grade states use supportive wording ("This one needs some attention").

---

## 4. Dashboard Layout

The dashboard is the home screen and is deliberately **minimal**: **three main widgets** plus the 7-day banner, a header grades chip and a quick-add button. Everything else lives on its own page one tap away. It is designed **phone-first** (single column, thumb-reachable actions); on desktop it becomes a wider two-column layout of the same widgets, not a different design.

Reading order on a phone (top to bottom):

| # | Widget | Content | Notes |
|---|---|---|---|
| 0 | **7-day notice banner** | "Tests in the next 7 days" — a full-width banner listing every test that has entered its 7-day window, with days left and free study hours; includes the test-cluster warning when relevant | Shown at the very top while at least one test is ≤ 7 days away; a student can collapse it for the session, it returns on the next open, and it disappears once the tests have passed |
| 1 | **Next test hero + countdown** | Subject, title, date, lesson slot (from schedule), big countdown (d/h/m), soft readiness badge, "Start studying" button; a small row of the next 2–3 tests as chips below it | **First thing the student sees** (below the banner). Largest card; accent gradient border matching urgency |
| 2 | **Today's schedule** | Today's lessons in order (time, subject, room), current/next lesson highlighted, tests of the day flagged | Driven by the **Schedule** tab; on days off shows free study time |
| 3 | **Today's Mission** | Up to 3 tasks with duration, start button, streak flame and weekly-goal ring | Replaces a long checklist on small screens |

Also on the dashboard:
- **Header:** logo, language toggle (HE/EN), **overall-average chip** (e.g., "Avg 86.4"; tap opens the Grades page; hidden until at least one grade exists), **sync status ("Updated 3 min ago" + Refresh)**, notifications bell, avatar/settings.
- **Quick add:** floating "+" button → add a **local** test (§3.1 F1), log a session, or add a task.
- **Navigation:** left sidebar on desktop (right side in RTL), bottom tab bar on mobile: Dashboard · Schedule · Calendar · Exams · Grades · Settings.

**Where the other widgets moved** (nothing is dropped):

| Former widget | Now lives on |
|---|---|
| Grades overview (per-subject averages, trends, sparklines) | **Grades** page |
| This week (mini agenda), workload heat map | **Calendar** page |
| Study hours chart, streak and weekly-goal detail | **Study log** page |
| Subject readiness | **Exams** page (per exam) and Exam detail |
| Bagrut tracker | **Bagrut tracker** page (hidden in simple mode, §4.2) |

**Empty states:** friendly illustration + one clear call to action ("Connect your Google Sheet" / "Add your first exam").

### 4.2 Simple mode and full mode
The student's **grade level** chosen at onboarding sets the default mode; it can be changed in Settings at any time.

| | **Simple mode** (grades 7–9, ז–ט) | **Full mode** (grades 10–12, י–יב) |
|---|---|---|
| Dashboard | Same 3 widgets + banner | Same 3 widgets + banner |
| Grades | Averages, trend, weak-subject flag, targets and "grade needed" — **same as full** | Same |
| **Hidden in simple mode** | **Bagrut tracker** (page and tab), **predicted final grade (A3)**, **readiness score (A4)** and the what-if slider (A5) | Available |
| Wording | Shorter, friendlier copy; fewer options in Settings | Full options |

Test-cluster warnings and the workload heat map stay available in both modes.

### 4.3 Readiness wording and tone
The app never shames a student for being behind. Status labels are soft, and **red is reserved for time pressure** (a test in under 24 hours), not for the student's progress.

| Internal state (§9.3) | EN label | HE label | Color |
|---|---|---|---|
| ratio ≥ 1.25 | On track | בקצב טוב | `--ok` |
| 0.9 ≤ ratio < 1.25 | A bit tight | קצת צפוף | `--warn` |
| ratio < 0.9 | Needs a boost | דרושה תוספת | `--warn` (stronger fill) + icon |

Every non-green state shows a **small, doable next step** instead of a warning, e.g. "A small boost: +25 min a day gets you there" / "תוספת קטנה של 25 דקות ביום תעשה את ההבדל" and a one-tap lighter plan (catch-up mode, S9). The label always comes with an icon and text, never color alone.

### 4.1 Screen specifications

Common to every screen:
- **States:** *loading* (skeleton cards, never a blank page), *empty* (illustration + one action), *error* (what happened + one recovery action), *offline* (cached data + "last updated" label).
- **Mobile-first:** one column under 768 px, sticky bottom nav, 16 px gutters; desktop uses the 12-column grid.
- **RTL:** all layouts flip via logical properties (§7). Copy below shows **EN / HE**. Hebrew copy is gender-neutral (nouns, infinitives, "יש לך").

#### 4.1.1 Onboarding (first run)
- **Steps (4 screens, skippable where possible):** 1) language → 2) grade level (ז–יב), which sets **simple mode** (ז–ט) or **full mode** (י–יב), see §4.2 → 3) connect the Google Sheet (or "Open the template") → 4) notifications and channel choice, with a short explanation of the mandatory 7-day notice.
- **Layout:** centered card, progress dots, one primary button.
- **Copy:** "Connect your Google Sheet" / "חיבור גיליון Google"; "Use the template" / "שימוש בתבנית"; "You'll get a notice 7 days before every test" / "תישלח התראה 7 ימים לפני כל מבחן".
- **Errors:** wrong sheet structure → list of missing tabs/columns with a link to the template ("Missing tab: Exams" / "חסרה לשונית: Exams").

#### 4.1.2 Dashboard
- Widgets per §4 table: 7-day banner (if any) → next-test hero → today's schedule → Today's Mission. The header shows the overall-average chip. On a phone the hero card and the banner are both visible without scrolling.
- **Greeting:** "Good evening" / "ערב טוב" (no name required).
- **Empty:** "No sheet connected yet" / "עדיין לא חובר גיליון" + button "Connect" / "חיבור".
- **Banner copy:** "3 tests in the next 7 days" / "3 מבחנים בשבוע הקרוב"; cluster: "3 tests in 4 days — start by Sun 21 Sep" / "3 מבחנים ב-4 ימים — כדאי להתחיל עד יום א׳, 21.9".
- **Readiness badges:** On track / בקצב טוב · A bit tight / קצת צפוף · Needs a boost / דרושה תוספת (always icon + text; tone rules in §4.3).

#### 4.1.3 Schedule
- **Purpose:** the weekly timetable and today's context.
- **Layout:** desktop — weekly grid (rows = periods, columns = school days, RTL order in Hebrew); mobile — day tabs with a vertical list. Tests appear as colored tags on their lesson slot; current lesson highlighted.
- **Interactions:** tap a lesson → drawer with subject, room, teacher, upcoming test for that subject, and grades summary.
- **States:** no schedule tab → "Add a Schedule tab to see your timetable" / "יש להוסיף לשונית Schedule כדי לראות מערכת שעות". Day off → "No lessons today" / "אין שיעורים היום" + free study time.

#### 4.1.4 Calendar
- **Purpose:** planning across weeks; lessons + tests + tasks + blocks.
- **Layout:** week view (default) and month view; optional heat-map toggle; legend by subject color.
- **Interactions:** drag a study task to another day (blocked if it exceeds that day's cap, with a message); tap a test → Exam detail.
- **Copy:** "Heavy week: 3 tests" / "שבוע עמוס: 3 מבחנים".

#### 4.1.5 Exams list
- **Layout:** filter chips (All / This week / This month / Bagrut / Done), sortable list; each row = subject color, title, type, date, countdown chip, readiness badge, source tag ("Sheet"/"Local").
- **Empty:** "No tests yet — add one in your sheet" / "אין מבחנים עדיין — אפשר להוסיף בגיליון".
- **Actions:** Add local test (P1), open detail.

#### 4.1.6 Exam detail
- **Header:** subject, title, type/moed, date, lesson slot, big countdown.
- **Sections:** readiness card (available / needed / logged, formula on tap) · study plan (task list, move/skip/regenerate) · topics with confidence sliders and progress · prep checklist · reminders (7-day notice always on; other lead times toggles) · notes · after the date: post-exam reflection and actual grade when it appears.
- **Copy:** "Time available 9h · needed 12h · logged 3h" / "זמן פנוי 9 ש׳ · נדרש 12 ש׳ · נלמד 3 ש׳"; needs a boost: "A small boost: +25 min a day gets you there" / "תוספת קטנה של 25 דקות ביום תעשה את ההבדל".

#### 4.1.7 Grades overview
- **Header:** overall average (large), bagrut average (units-weighted, if applicable), number of grades, last-updated.
- **List:** one card per subject: average, trend arrow, sparkline, weak-subject tag, target progress.
- **Sorting:** by name / lowest average / most recent change.
- **Empty:** "No grades yet" / "עדיין אין ציונים". Single grade: no trend shown.
- **Info button** on every number → "How is this calculated?" bottom sheet (§9.6).

#### 4.1.8 Subject detail (grades)
- **Layout:** line chart of grades over time (reading direction follows language), table of grades (date, title, grade, weight), stats (avg, weighted avg, min, max, trend).
- **Tools:** target-average input → "grade needed on the next test"; what-if slider ("If I get 85…"); for bagrut subjects: final-grade calculator with school/exam weights (§9.8) and predicted final range (§9.11) when data allows.
- **Copy:** "You need 88 on the next test to reach 85" / "כדי להגיע ל-85 נדרש ציון 88 במבחן הבא"; unreachable: "Not reachable with one test" / "אי אפשר להגיע ליעד עם מבחן אחד".

#### 4.1.9 Study log & timer
- **Layout:** timer card (subject picker, topic picker, Start), today's sessions, week chart, streak and weekly goal.
- **Timer:** focus 25 / break 5 by default; continues in background; end-of-session prompt "Log 25 min for Math?" / "לתעד 25 דקות במתמטיקה?".
- **Manual entry:** subject, topic, duration, date.

#### 4.1.10 Notification center
- **List** of every notice with type (7-day, day-before, digest, cluster), test, time sent, channel.
- **Settings shortcut:** channels, quiet hours, quiet mode.
- **Empty:** "No notices yet" / "אין התראות עדיין".

#### 4.1.11 Settings & Sheet connection
- **Sections:** Language · Google Sheet (status, last sync, change sheet, disconnect + wipe cache) · Notifications (channels, notice time, quiet hours, digest) · Study (daily cap, weekly goal, availability override, school days incl. Friday) · Grades (scale, pass mark, weighting, targets, bagrut school/exam split) · Privacy (what is read, export/import backup, delete local data).
- **Sheet status copy:** "Connected — Updated 3 min ago" / "מחובר — עודכן לפני 3 דקות"; error: "No access to the sheet" / "אין גישה לגיליון" + "Reconnect" / "חיבור מחדש".

#### 4.1.12 Sync issues
- **Layout:** table (tab, row number, problem, how to fix); "Open sheet" button; count badge in the header when > 0.
- **Copy:** "2 rows need fixing" / "2 שורות דורשות תיקון"; example: "Exams, row 7: date not recognized" / "Exams, שורה 7: התאריך לא זוהה".
- Rows can be re-checked with "Refresh"; fixed rows disappear automatically.

#### 4.1.13 Bagrut tracker
- **Layout:** table/cards per bagrut subject: units, school grade (ציון מגן), moed A/B dates, exam grade (when known), final grade calculator, readiness score with breakdown, topic coverage bar.
- **Summary row:** bagrut average weighted by units (§9.8).
- **Hidden from navigation** in simple mode (grades 7–9) and for students without bagrut subjects.

---

## 5. Key User Flows

1. **First run:** choose language → connect Google Sheet (or open the template) → data loads → allow notifications → land on dashboard with today's schedule, countdowns and grade averages.
2. **New test appears in the sheet:** next sync picks it up → dashboard shows it → if ≤ 7 days away a notice fires now, otherwise it fires exactly 7 days before → plan generated from free time in the schedule.
3. **Seven days before a test:** in-app banner / email / push with days left and study hours available → tap → exam details with plan → accept or adjust plan.
4. **Daily use:** open dashboard → check Today's schedule and Today's Mission → start timer → finish tasks → see readiness and streak update.
5. **Needing a boost:** hero card shows "Needs a boost" with a small suggestion → tap → lighter catch-up plan (+ minutes per day) → accept or dismiss.
6. **Exam date changes in the sheet:** next sync updates the exam → plan and reminders (including the 7-day notice) regenerate automatically.
7. **New grade added in the sheet:** next sync updates that subject's average and trend; a toast shows "Math average: 87.4 (+1.2)"; post-exam reflection is compared with the real grade.
8. **Sheet problem:** invalid rows or lost access → "Sync issues" panel explains what to fix; cached data stays visible.
9. **Heavy week ahead:** cluster detected → banner suggests a start date → student accepts → plan starts earlier.

---

## 6. Design System (Dark Mode)

Goal: dark, calm and easy on the eyes late at night, but **not dull** — layered surfaces, vivid accents and soft glows keep it feeling modern and motivating.

### 6.1 Color tokens
Defined as CSS variables so they can be tuned in one place.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0E1117` | App background (near-black with a blue tint, not pure black) |
| `--surface` | `#161B26` | Cards |
| `--surface-2` | `#1E2533` | Raised elements, inputs, hover |
| `--border` | `#2A3345` | Card and divider borders |
| `--text` | `#E8ECF4` | Primary text |
| `--text-muted` | `#9AA5BA` | Secondary text |
| `--primary` | `#7C6CFF` | Main accent (violet-indigo), buttons, focus |
| `--primary-glow` | `rgba(124,108,255,.35)` | Glows and focus rings |
| `--accent` | `#3DDBD9` | Secondary accent (teal), charts, highlights |
| `--ok` | `#3DDC97` | On track / done |
| `--warn` | `#FFB454` | A bit tight / Needs a boost / soon |
| `--urgent` | `#FF6B7A` | Time pressure only (test within 24 h) |

Subject colors: a fixed 10-color palette of medium-saturation hues, all tested against `--surface` for AA contrast.

### 6.2 Making dark mode appealing
- **Depth through lightness, not shadows:** each elevation level is slightly lighter (`bg` → `surface` → `surface-2`).
- **Gradients:** subtle violet→teal gradient on the hero card border and primary buttons.
- **Soft glow** on the most urgent element only, so it draws the eye without clutter.
- **Rounded shapes:** card radius 16px, buttons/inputs 12px, chips fully rounded.
- **Generous spacing:** 8px base grid; 24px card padding on desktop, 16px on mobile.
- **Avoid pure white text** on dark to reduce glare; avoid saturated colors for large fills.

### 6.3 Typography
- **Font:** a family with full Hebrew + Latin support (e.g., **Heebo** or **Assistant**) for consistent look in both languages.
- Scale: 12 / 14 / 16 (body) / 20 / 24 / 32 / 48 (countdown numerals).
- Countdown numerals use tabular figures so digits don't jitter as they tick.

### 6.4 Urgency color coding
| Time to exam | Color | Behavior |
|---|---|---|
| > 14 days | `--accent` (teal) | Static |
| 4–14 days | `--primary` | Static |
| 1–3 days | `--warn` | Subtle glow |
| < 24 hours | `--urgent` | Glow + gentle pulse (respects reduced motion) |

Readiness status uses `--ok` / `--warn` (soft labels, §4.3) **plus an icon and label**, never color alone. `--urgent` (red) is used **only for time pressure** — a test in under 24 hours or a mandatory notice that just fired — never to describe the student's progress.

### 6.5 Components
Card, stat tile, countdown, progress bar, progress ring, chip, checklist item, modal/sheet, toast, form controls, tabs, sidebar, bottom nav, empty state, calendar cell, timetable cell, sparkline, heat-map cell, streak flame, notice banner, info ("how is this calculated?") bottom sheet.

### 6.6 Motion
- 150–250 ms ease-out transitions; number count-up on load; check-off animation on tasks; small confetti when all Mission tasks are done.
- Honor `prefers-reduced-motion`: disable pulse/count-up/confetti.

### 6.7 Accessibility
- WCAG AA contrast (≥ 4.5:1 body text, ≥ 3:1 large text/UI).
- Visible focus ring using `--primary-glow`.
- Full keyboard navigation; ARIA labels on countdowns (announce as "in 3 days, 4 hours").
- Touch targets ≥ 44px.
- Charts have a text/table alternative.

---

## 7. Internationalization (Hebrew / English)

- **Toggle** in header and settings; choice persisted; default from browser language.
- **Direction:** `dir="rtl"` for Hebrew, `dir="ltr"` for English, set on `<html>`.
- Use **CSS logical properties** (`margin-inline-start`, `padding-inline-end`, `inset-inline`) instead of left/right so layouts flip automatically.
- Mirror direction-sensitive icons (arrows, chevrons); do **not** mirror numbers, clocks or media controls.
- **Charts:** the time axis runs in the reading direction (right-to-left in Hebrew); numbers and tick labels stay left-to-right.
- Sidebar moves to the right in RTL; progress bars fill from the reading-start side.
- **Dates & numbers:** `Intl.DateTimeFormat` / `date-fns` locale (`he`, `en`); week starts Sunday by default.
- **Hebrew calendar date** shown next to the civil date: **on by default in Hebrew mode, off in English mode**, toggle in Settings (Decision D4).
- All strings in translation files (`locales/he.json`, `locales/en.json`); no hard-coded text; pluralization via i18next (Hebrew has distinct plural forms, including a dual for some nouns, e.g., "יומיים").
- Mixed-direction text (English subject names inside Hebrew UI) wrapped with `<bdi>` to avoid punctuation flipping.
- **Gender-neutral Hebrew copy:** prefer nouns, infinitives and "יש לך" over gendered verb forms; avoid addressing the student as male or female.
- Sheet headers may be Hebrew or English (alias table) so a Hebrew-speaking student can name columns naturally.

### 7.1 Israeli school specifics

| Topic | Spec |
|---|---|
| **Terminology** | בוחן = quiz; מבחן = test; בחינה = exam; בגרות = matriculation; מועד א׳ / מועד ב׳ = first / second sitting; ציון מגן = school ("shield") grade; יחידות לימוד = study units; תעודת בגרות = matriculation certificate. The UI uses these Hebrew terms in Hebrew mode. |
| **Grade levels** | Middle school ז–ט (7–9), high school י–יב (10–12). The level selects sensible defaults (e.g., bagrut tracker visible from י). |
| **Grade scale** | 0–100 by default. |
| **Pass mark** | Default **55** (widely cited for bagrut exams), configurable per subject because schools vary. |
| **Bagrut final grade** | Each bagrut subject's final grade combines the school grade and the exam grade. **Default: 70% bagrut exam + 30% school grade** (`schoolWeight = 0.3`), as set by the product owner (Decision D9). It stays a per-subject setting because secondary sources report other splits (e.g., 50/50) and schools may differ; the Ministry booklet consulted did not state it (§14). |
| **Study units** | Bagrut subjects are studied at 3, 4 or 5 units (2 in some subjects). The bagrut average is weighted by units (§9.8). University-admission bonuses for 4/5-unit subjects are **out of scope**. |
| **Bagrut sittings** | Moed A / Moed B dates are published by the Ministry; the student (or teacher) enters them in the Exams tab. Exams with `type = bagrut` carry a `moed` value; both sittings of a subject share a `moedGroup` so the app can show that Moed B is a retake. |
| **Core bagrut subjects** | Commonly cited compulsory areas include Hebrew, English, Mathematics, Tanakh (Bible), Literature, History and Civics. The list **must be verified** with the Ministry before being used for any "missing requirement" feature; v1 does not warn about missing requirements. |
| **School week** | Sunday–Thursday full days; Friday is a short day or off depending on the school — configurable (School / Short / Off). Weekend for planning is Friday-evening to Saturday. |
| **Holidays & vacations** | Entered in the **Holidays** tab (date, name, type `off`/`short`); they become free study days and are excluded from "school day" logic. Optional Hebrew-date display (§7). |
| **Time zone** | `Asia/Jerusalem`; Daylight Saving changes are handled via IANA time zone data, never fixed UTC offsets. |
| **Calendar naming** | Weekdays shown as "יום א׳ … שבת" in Hebrew; dates as `28.9` (day.month) in Hebrew mode. |

---

## 8. Data Model

Entities and key fields (types are indicative). Entities marked **(sheet)** come from Google Sheets and are read-only; the rest are **local** to the device in v1 (see Decision D2 for the consequences).

```
User (local)
  id, displayName?, language ("he"|"en"), gradeLevel, createdAt

Settings (local)
  userId, dailyStudyCapMinutes, weeklyGoalMinutes, weekStartsOn, fridayMode ("school"|"short"|"off"),
  quietHoursStart, quietHoursEnd, noticeTime (default 16:00), dailyReminderTime,
  defaultLeadTimes[], channels{inApp, email, push}, digest ("off"|"weekly"),
  showHebrewDate, gradeScaleMax (default 100), passMark (default 55), weightByUnits

SheetConnection             // the linked Google Spreadsheet
  userId, spreadsheetId, authMode ("spreadsheets_readonly"|"public_csv"),
  lastSyncAt, status ("ok"|"error"|"no_access"), lastError?

SyncIssue                   // row-level problems found during sync
  id, tab, rowNumber, message, detectedAt

ScheduleEntry (sheet)       // weekly timetable, from the Schedule tab
  id, weekday (0-6), period, startTime, endTime, subjectId?, room?, teacher?,
  type ("lesson"|"off"), validFrom?, validTo?, date? (one-off override)

Holiday (sheet)             // from the Holidays tab
  id, date, name, type ("off"|"short")

AvailabilitySlot (local)    // free study time; derived from ScheduleEntry, editable
  userId, weekday (0-6), startTime, endTime, source ("schedule"|"manual")

BlockedTime (local)         // one-off unavailable time
  userId, start, end, reason

Subject (sheet)
  id, name, color, units? (bagrut), isBagrut, targetAverage?,
  schoolWeight? (0-1, bagrut), remainingWeight? (grade weight still to come), passMark?

Exam (sheet, or local)
  id, subjectId, title, type ("quiz"|"test"|"exam"|"project"|"bagrut"),
  moed? ("A"|"B"), moedGroup?, startsAt, weight (1-5), difficulty (1-5),
  recommendedMinutes (computed, overridable), notes, status ("upcoming"|"done"),
  source ("sheet"|"local"), sheetRowKey?, scheduleEntryId? (matched lesson slot)

Grade (sheet)               // from the Grades tab
  id, subjectId, value, scaleMax (default 100), weight (default 1), date, title?,
  type? ("test"|"quiz"|"bagrut_exam"|"school"|...), source ("sheet"|"local"), sheetRowKey?

Topic (sheet or local)      // from the Topics tab or added locally
  id, examId?, subjectId, title, estimatedMinutes, sheetRowKey?

TopicProgress (local)
  topicId, status ("todo"|"in_progress"|"done"), confidence (1-5)?, completedAt?

StudyTask (local)           // generated or manual plan item
  id, examId, topicId?, date, plannedMinutes, kind ("study"|"revision"), status ("planned"|"done"|"skipped")

StudySession (local)        // actual time logged
  id, subjectId, examId?, topicId?, startedAt, durationMinutes

Reflection (local)          // post-exam reflection
  examId, expectedScore?, feltPrepared (1-5)?, note?, createdAt

Streak (local)
  currentDays, longestDays, lastCountedDate, freezeUsedOn?

Goal (local)
  weekStart, targetMinutes, loggedMinutes

Reminder (local)
  id, examId, kind ("week_before"|"custom"|"day_before"|"morning_of"|"hour_before"),
  fireAt, channel ("in_app"|"email"|"push"), sentAt?

Notification (local)        // what the notification center lists
  id, kind ("week_before"|"cluster"|"digest"|"daily"|...), examIds[], body, createdAt, readAt?
```

**Relationships:** User 1—1 SheetConnection; Subject 1—* Exam 1—* Topic; Subject 1—* Grade; Subject 1—* ScheduleEntry; Exam *—1 ScheduleEntry (matched lesson); Exam 1—* StudyTask; Topic 1—1 TopicProgress; User 1—* StudySession; Exam 1—* Reminder (always includes one `week_before`); Exam 1—1 Reflection.

### 8.1 Google Sheet template

One spreadsheet per student (Decision D8). Row 1 of every tab is a header; header names are matched case-insensitively and may be Hebrew or English (aliases table in the code). Dates use `YYYY-MM-DD` (or the sheet's native date format), times `HH:MM`.

| Tab | Columns | Notes |
|---|---|---|
| **Schedule** | `weekday`, `period`, `start`, `end`, `subject`, `room`, `teacher`, `type`, `date`, `validFrom`, `validTo` | `weekday` 1–7 (Sun–Sat) or name; `type` = `lesson` (default) or `off`; `date` (optional) makes the row a one-off override for that day; `validFrom`/`validTo` (optional) limit a row to a semester |
| **Exams** | `date`, `time`, `subject`, `title`, `type`, `moed`, `weight`, `difficulty`, `topics`, `notes` | `type` = quiz/test/exam/project/bagrut; `moed` = A/B (bagrut); `topics` comma-separated; `weight` and `difficulty` optional (default 3) |
| **Grades** | `date`, `subject`, `title`, `grade`, `weight`, `type` | `grade` numeric; `weight` optional (default 1); `type` optional |
| **Subjects** *(optional)* | `name`, `color`, `units`, `isBagrut`, `targetAverage`, `schoolWeight`, `remainingWeight`, `passMark` | If missing, subjects are created from names found in other tabs. `schoolWeight` is 0–1 (or a percentage); default 0.3 for bagrut subjects |
| **Topics** *(optional)* | `subject`, `exam`, `topic`, `estimatedMinutes` | Gives the plan generator real topics; `exam` is the exam title (optional) |
| **Holidays** *(optional)* | `date`, `name`, `type` | `type` = `off` or `short` |

Rules:
- Subject names are matched exactly (after trimming and case-folding) across tabs; unknown names are reported in Sync issues.
- Each row gets a stable key (`tab + row number + hash of subject/date/title`) so edits update the same record rather than creating duplicates.
- Empty rows are ignored; invalid rows are skipped and reported, never crash the sync.
- A `weight` of 0 or negative is invalid (reported); a grade above the scale maximum or below 0 is invalid (reported).

---

## 9. Key Algorithms

### 9.1 Time needed (recommended study minutes)
```
base        = 120 min per exam                    (tunable)
byType      = { quiz: 0.5, test: 1, exam: 1.5, project: 1, bagrut: 3 }
byDifficulty= 0.6 + 0.2 * difficulty              (difficulty 1–5 → 0.8–1.6)
byTopics    = sum(topic.estimatedMinutes) if provided, else base
needed      = max(byTopics, base) * byType * byDifficulty * (0.8 + 0.1 * weight)
```
User can override `recommendedMinutes` per exam. Constants live in one config file.
Low-confidence topics (confidence 1–2) add +25% to their `estimatedMinutes`; high-confidence topics (5) subtract 15%.

### 9.2 Time available
Free time comes from the **school schedule**:
```
freeWindows(day) = [dayStart, dayEnd] − lessons(day) − BlockedTime(day)
                   (dayStart/dayEnd default 14:00–21:30 on school days, 09:00–21:30 on days off;
                    also removes 30 min buffer after the last lesson; tunable)
available = Σ over days from now → exam:
              min( minutes(freeWindows(day)) , dailyStudyCapMinutes )
```
Manual `AvailabilitySlot` entries (`source = "manual"`) override the derived windows for that weekday. Days marked `off` (schedule or Holidays tab) count as fully free; `short` days use their shortened lesson list.

### 9.3 Readiness
```
remainingNeeded = max(0, needed − logged)
ratio           = available / remainingNeeded      (∞ if remainingNeeded = 0)

status = ratio ≥ 1.25 → "On track"
         ratio ≥ 0.9  → "A bit tight"
         else         → "Needs a boost"                 (labels and tone: §4.3)

extraPerDay = (remainingNeeded − available) / daysLeft   (shown as a gentle suggestion when not "On track")
```

### 9.4 Plan generation
1. Collect available days (with minutes) up to the exam; exclude the final 12h before the exam.
2. Order topics by estimated size (largest first), then by low confidence, and by status (skip `done`).
3. Distribute topic minutes across days, chunked to 25–60 min blocks, never exceeding the daily cap.
4. Reserve the last 1–2 days for revision when time allows.
5. On missed tasks or date change → regenerate remaining tasks only; keep completed history.

### 9.5 Reminder scheduling
- **Always create a `week_before` reminder** for every exam: `fireAt = date(exam.startsAt) − 7 days` at the chosen notice time (default 16:00).
  - If that moment is already in the past but the exam is still in the future → `fireAt = now` (fires on the next sync, once).
  - If the exam moves → delete the unsent `week_before`, create a new one; if the old one was already sent, send a new one only when the new date is different and still ≥ 1 day away.
  - Several exams sharing the same `fireAt` day are merged into one notification listing all of them.
  - The notification body includes readiness from §9.3 (hours free vs. hours needed) and a cluster warning from §9.13 when relevant.
- For other lead times: `fireAt = exam.startsAt − leadTime`; skip times in the past.
- Shift any `fireAt` that falls in quiet hours to the next allowed time (but never after the exam).
- Store timezone-aware (default `Asia/Jerusalem`); recompute on exam edit.
- **Guaranteed delivery order for the 7-day notice:** (1) in-app banner and notification-center entry are always created; (2) email via Apps Script and Web Push are added when the student enabled them. A notice is marked `sent` only when its in-app entry exists.

### 9.6 Grade averages
For a subject with grades `g₁…gₙ` and weights `w₁…wₙ` (weight defaults to 1):
```
simple average   = Σ gᵢ / n                       (all weights empty or equal)
weighted average = Σ (gᵢ · wᵢ) / Σ wᵢ             (any weight present)
overall average  = mean of subject averages       (default)
                 = Σ (avgₛ · unitsₛ) / Σ unitsₛ   (when "weight by units" is on and units are set)
trend            = see §9.10
neededGrade      = (target · (W + w) − Σ gᵢ·wᵢ) / w      (W = Σ wᵢ, w = weight of the next test)
```
- Round for display to **1 decimal**; keep full precision internally.
- Grades are normalized to the configured scale (`grade / scaleMax * 100`) before averaging across subjects.
- No grades → `null` ("No grades yet"), never 0. A subject with a single grade shows no trend.
- `neededGrade > scaleMax` → show "Target not reachable with the next test"; `neededGrade ≤ 0` → "Target already secured".
- **Worked example:** grades 90 (w=1) and 80 (w=2) → weighted average = (90·1 + 80·2) / 3 = **83.3**; simple average would be 85.0.
- **Needed-grade example:** grades 90 (w=1), 80 (w=2) → Σg·w = 250, W = 3; target 85 with next test weight 2 → (85·5 − 250) / 2 = **87.5**.

### 9.7 Sync
1. Fetch the tabs (Sheets API `values.batchGet` on Schedule, Exams, Grades, Subjects, Topics, Holidays) — one request per sync.
2. Parse and validate each row; collect `SyncIssue`s for bad rows.
3. Upsert records by `sheetRowKey`; delete local copies of `source = "sheet"` rows that vanished from the sheet.
4. Diff against the previous state: new/changed exams → (re)schedule reminders (§9.5); new grades → recompute averages and toast changes.
5. Recompute readiness (§9.3) and the plan (§9.4) only for exams affected by the change.
6. On network/permission failure: keep cached data, set `SheetConnection.status`, retry with exponential backoff (1 → 2 → 5 → 15 min).

### 9.8 Bagrut subject final grade and bagrut average
```
finalGrade      = s · schoolGrade + (1 − s) · examGrade         (s = Subject.schoolWeight, 0–1)
neededExamGrade = (target − s · schoolGrade) / (1 − s)           (s < 1)
bagrutAverage   = Σ (finalGradeₛ · unitsₛ) / Σ unitsₛ
```
- `s` defaults to **0.3** (bagrut exam 70%, school grade 30%, Decision D9). The student or the sheet (`schoolWeight` column) can change it per subject; the calculator always shows the weights in use.
- **Worked example (needed exam grade):** school grade 84, `s = 0.3`, target final 85 → (85 − 0.3·84) / 0.7 = 59.8 / 0.7 = **85.4**. With `s = 0.5` the same target needs (85 − 42) / 0.5 = **86.0**.
- **Worked example (bagrut average):** Math 5 units final 90, English 4 units final 80, Bible 2 units final 70 → (90·5 + 80·4 + 70·2) / 11 = 910 / 11 = **82.7**.
- Edge cases: `neededExamGrade > 100` → "Not reachable"; a subject without an exam grade yet is excluded from the average and listed as "pending".

### 9.9 Weak-subject detection
A subject is flagged **weak** when any of these holds (thresholds configurable):
1. average < **70**;
2. trend is **falling** (§9.10);
3. a target is set and average < target − **5**.

Needs ≥ 2 grades (rule 2 needs ≥ 3). **Example:** Math average 66 → weak (rule 1). English average 78, grades 88, 82, 79 → slope −4.5 → weak (rule 2). History average 84 with target 90 → weak (rule 3, 84 < 85).
The flag only changes ordering and wording ("Needs attention"); it never triggers alerts by itself.

### 9.10 Grade trend
Linear regression of grade against test index over the **last up to 5 grades** (ordered by date), requires ≥ 3 grades:
```
slope = Σ (xᵢ − x̄)(yᵢ − ȳ) / Σ (xᵢ − x̄)²          (x = 1, 2, 3, …)
label = rising  if slope ≥ +2
        falling if slope ≤ −2
        stable  otherwise                            (points per test)
```
- **Worked example:** grades 88, 82, 79 → x̄ = 2, ȳ = 83; numerator = (−1)(5) + 0 + (1)(−4) = −9; denominator = 2 → slope = **−4.5** → falling.
- Fewer than 3 grades → no arrow. The simple "change vs. previous average" shown in toasts (§5) is separate and can appear with 2 grades.

### 9.11 Predicted final grade (range)
Shown only when `Subject.remainingWeight` (R) is provided in the sheet:
```
A = weighted average so far,  W = weight so far
σ = max(5, standard deviation of the grades)         (points)
low  = (A·W + max(0, A − σ)·R)   / (W + R)
high = (A·W + min(scaleMax, A + σ)·R) / (W + R)
```
- **Worked example:** A = 80, W = 4, σ = 6, R = 2 → low = (320 + 74·2) / 6 = **78.0**, high = (320 + 86·2) / 6 = **82.0**.
- Displayed as "Likely 78–82"; never as one exact figure. Hidden when R is missing or there are fewer than 3 grades.

### 9.12 Bagrut readiness score
```
gradeScore    = current subject average (0–100), or 50 if no grades yet
studyScore    = min(1, loggedMinutes / neededMinutes) · 100
coverageScore = doneTopics / totalTopics · 100            (skipped if there are no topics)
readiness     = 0.4·gradeScore + 0.3·studyScore + 0.3·coverageScore
                (if coverage is skipped: 0.55·gradeScore + 0.45·studyScore)
label         = ≥ 80 "Ready" · 60–79 "Almost there" · < 60 "Needs work"
```
- **Worked example:** average 82, logged 6 h of 10 h needed, 5 of 8 topics done → 0.4·82 + 0.3·60 + 0.3·62.5 = 32.8 + 18 + 18.75 = 69.55 → **70**, "Almost there".
- The three components are always shown next to the score so the student sees what to improve.

### 9.13 Test-cluster detection and workload
- A **cluster** is ≥ 3 tests within any 4 consecutive calendar days, or ≥ 2 tests on the same day.
- `suggestedStart = firstTestDate − ceil(Σ neededMinutes / avgDailyAvailableMinutes)` days, never earlier than today.
- **Worked example:** tests on Sun, Tue and Wed (3 in 4 days), Σ needed = 20 h, average daily availability 2.5 h → 20 / 2.5 = 8 days before Sunday.
- **Weekly workload** for the heat map: `load = Σ exam.weight` of tests in that Sun–Sat week → levels 0, 1–2 (light), 3–5 (medium), 6+ (heavy).

### 9.14 Today's Mission ranking
```
urgency        = 1 / (daysLeft + 1)                       (exam today = 1.0)
weakness       = (100 − subjectAverage) / 100             (0.5 if no grades)
confidenceGap  = (5 − topicConfidence) / 4                (0.5 if unrated)
score          = 0.5·urgency + 0.3·weakness + 0.2·confidenceGap
```
- Pick the top 3 tasks whose total minutes fit the daily cap; at most 2 from the same subject.
- **Worked example:** Task A — exam in 2 days (urgency 0.333), subject average 62 (weakness 0.38), confidence 2 (gap 0.75) → 0.167 + 0.114 + 0.15 = **0.431**. Task B — exam in 6 days (0.143), average 90 (0.10), confidence 4 (0.25) → 0.071 + 0.03 + 0.05 = **0.151**. A ranks first.
- Recomputed at midnight and after a sync; the student can swap a task (which reranks the rest).

### 9.15 Streaks, weekly goal and spaced revision
- A day **counts** if logged study time ≥ 20 min **or** ≥ 1 Mission task is completed.
- `streak` = consecutive counted days (school holidays and configured off-days do not break it). One **freeze** per 7 days is applied automatically; if a day is missed with no freeze available the streak shows as **paused** and restarts at the next counted day (longest streak is kept).
- **Weekly goal** = Σ session minutes Sun–Sat vs `weeklyGoalMinutes` (default 300).
- **Spaced revision:** when a topic is marked done on day *d* and the exam is later than *d + 1*, create 15-minute `revision` tasks at *d + 1*, *d + 3*, *d + 7* (only those before the exam; skip days without free time).

---

## 10. Suggested Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | **React + TypeScript** with **Vite** | Fast dev, strong typing for the data model |
| Styling | **Tailwind CSS** with theme tokens as CSS variables | Fast UI work; logical-property utilities support RTL |
| i18n | **i18next / react-i18next** | Plurals, namespaces, runtime language switch |
| Dates | **date-fns** (+ `he`, `en` locales), IANA time zones | Lightweight, locale-aware |
| Charts | **Recharts** | Simple, themeable |
| State | **Zustand** or React Query for server state | Small and simple |
| Data source | **Google Sheets API v4** with scope `spreadsheets.readonly`; sign-in with **Google Identity Services** | Read-only access; simplest flow (paste the sheet link); see §10.1 |
| Data source (prototype fallback) | Sheet "Publish to web" as CSV, fetched and parsed with **PapaParse** | Fastest way to demo; **not for real grades** (public link) |
| Persistence (v1) | **Local-first cache and progress store:** IndexedDB (Dexie) | Offline display; the sheet stays the source of truth for sheet data |
| Email notices (v1) | **Google Apps Script** bound to the template sheet, daily time trigger | Sends the 7-day notice by email with no backend; see §10.2 |
| Backend (later) | **Supabase** or **Firebase** (auth + DB + scheduled jobs + push) | Reliable Web Push, multi-device sync of local progress |
| Notifications | **Web Notifications API + Service Worker**; Web Push via backend | Best effort while the app is closed |
| PWA | Installable, offline shell | Students use phones |
| Testing | **Vitest** + **React Testing Library**, **Playwright** for e2e | Cover algorithms and RTL layouts |

### 10.1 Google access and scopes (fact-checked)
| Option | Classification (per Google docs) | Use |
|---|---|---|
| `spreadsheets.readonly` | **Sensitive** | **Chosen (Decision D19).** Read-only access to the student's spreadsheets; the student pastes the sheet link/ID. Requires **Google OAuth app verification** (consent screen, privacy policy, possibly a demo video) before students outside the test-user list can sign in — **start verification in M0**. |
| `drive.file` (+ Google Picker) | **Non-sensitive**; Google's documented "narrowest" Drive access | Not used in v1. Kept as a possible later switch if verification proves too slow (untested with the Sheets API). |
| `drive.readonly` / `drive` | **Restricted** | **Do not use** — broad access and heavier verification. |
| Public CSV | No sign-in | Prototype only; anyone with the link sees the grades. |

Quotas (Google Sheets API): **300 read requests per minute per project** and **60 per minute per user per project**, with **no daily limit** if the per-minute limits are respected. One `batchGet` per sync every 15 minutes is far below this.

### 10.2 Notification reliability (fact-checked)
| Channel | Works with app closed? | Notes |
|---|---|---|
| In-app banner + notification center | No (shown on next open) | **Always created**; the guaranteed fallback for the 7-day notice |
| **Email via Apps Script** | **Yes** | Daily trigger in the template's script sends the 7-day notice (and optional digest) to the address the student enters; the sheet owner authorizes the script once; subject to Google's Apps Script email quotas. Recommended for v1. |
| **Web Push** (with a backend) | Yes, when supported | Needs a backend to send. On **iOS/iPadOS 16.4+** it works only for a PWA **installed to the Home Screen**. |
| **Periodic Background Sync** (no backend) | Partly | **Experimental, Chromium-only, installed PWA only**, and Chrome decides the frequency from site engagement. **Must not be relied on**; treat as a bonus. |

### 10.3 Other notes
- Without a backend, local progress (tasks, sessions, confidence, streaks) lives in the browser on one device; provide JSON export/import so it can be backed up or moved (Decision D2).
- Alternative if simpler is preferred: plain HTML/CSS/JS with the published-CSV approach for a first prototype.

---

## 11. Non-Functional Requirements

- **Responsive, mobile-first:** breakpoints 360 / 768 / 1200 px; students mostly use phones.
- **Performance:** first contentful paint < 2 s on mid-range phone over 4G; dashboard interactive < 3 s.
- **Offline:** dashboard, exams, and plan usable offline (PWA).
- **Accessibility:** WCAG 2.1 AA (see §6.7).
- **Browser support:** latest two versions of Chrome, Safari, Firefox, Edge; Web Push on iOS requires iOS 16.4+ and an installed PWA.
- **Privacy & minors:**
  - Collect the minimum data (no real name required, no location).
  - **Grades are sensitive data about minors:** request only the read-only Sheets scope (§10.1), read only the tabs listed in §8.1, never share data with third parties, no analytics on grade values.
  - Do not require a public sheet link for real data; if the CSV prototype is used, warn the user that anyone with the link can see the grades.
  - In v1 there is no server-side storage of grades: data stays in the student's Google account and in the browser cache; OAuth tokens kept in memory/secure storage, revocable from Settings ("Disconnect Google Sheet" also wipes the cache).
  - Clear privacy statement in both languages, including exactly what is read from the sheet.
  - Before adding accounts/backend: review Israeli Privacy Protection Law and parental-consent requirements for users under 14/16 (this document is not legal advice).
  - Allow full data export and deletion.
- **Reliability of reminders:** local scheduling must survive reload. The 7-day notice is the highest-priority reminder: it must never be silently dropped — the in-app banner and notification-center entry are always created (§9.5, §10.2).
- **Sync:** ≤ 15-minute staleness while open; sync of a typical sheet (≤ 500 rows) completes in < 3 s; malformed rows never block the rest of the data.
- **Sheet permissions:** losing access (revoked, sheet deleted, not shared) shows a clear message with a "Reconnect" action; cached data remains visible.
- **Google verification lead time:** the `spreadsheets.readonly` scope is Sensitive, so Google's OAuth app verification is required before public launch; start it in M0 and allow several weeks. Until approved, only listed test users can sign in.

---

## 12. Roadmap

| Milestone | Scope |
|---|---|
| **M0 — Design & spikes** | Wireframes for all §4.1 screens; finalize dark palette; HE/EN copy; **Google Sheet template (Schedule / Exams / Grades / Subjects / Topics / Holidays) + Apps Script email**; **start Google OAuth verification for `spreadsheets.readonly`** (consent screen, privacy policy; D19) |
| **M1 — Data & core (P0)** | **Google Sheets connection + sync + cache + Sync issues panel**, data model, subjects, exams from sheet, countdown, dashboard hero + countdown strip, **Today's schedule**, onboarding |
| **M2 — Planning & grades (P0)** | Free time derived from schedule/holidays, time-left calculator, readiness status, study plan generator, **Today's Mission**, **grade averages per subject + overall + grades overview widget**, weak-subject flag, trend |
| **M3 — Reminders (P0)** | **Mandatory 7-day notice for every test** (in-app banner + notification center + Apps Script email), other lead times, quiet hours, grouping/dedup, test-cluster warning |
| **M4 — Calendar, logging & analytics (P1)** | Calendar views (lessons + tests + tasks), drag-to-reschedule, study timer/log, study-hours chart, streak + weekly goal, grade history charts, what-if / "what do I need?" helper, workload heat map |
| **M5 — Bagrut & polish (P1)** | Bagrut tracker (final-grade calculator, unit average, readiness score, predicted range), topic confidence + spaced revision, prep checklist, post-exam reflection, RTL audit, accessibility audit, empty states, PWA/offline, backup export/import |
| **M6+ — Later (P2)** | Backend + Web Push + multi-device sync, achievements, sharing, imports, parent view, study-vs-grade insight |

---

## 13. Decision Log and Open Items

Status legend: **Decided** = approved by the product owner; **Deferred** = consciously postponed, with the interim behavior stated. Every decision lists the sections it affects.

| ID | Question | Decision | Status | Why | Affects |
|---|---|---|---|---|---|
| D1 | Pre-filled bagrut subject/topic templates? | **Decide later.** Until then: not in v1; provide an example Topics tab students can copy. | Deferred | Content must be accurate and maintained; wrong syllabi would mislead. | §3.2, §8.1 |
| D2 | Backend in v1? | **No backend.** Reliable 7-day notice through in-app banner + Apps Script email; Web Push best effort. Local progress is per-device, with JSON backup. Backend in M6+. | Decided | Avoids accounts, hosting and minors' data obligations; keeps v1 small. | §10, §11, §9.5 |
| D3 | Minimum age / consent | Design for students **12+**. v1 stores no grades on a server, so consent needs are minimized; **legal review is a gate before any backend or account system.** | Decided | Grades are sensitive; laws depend on server-side processing. | §11 |
| D4 | Hebrew date display | **On by default in Hebrew mode** (shown next to the civil date, computed from the standard Hebrew calendar library); off by default in English mode; toggle in Settings. | Decided | Product owner's choice: Hebrew-speaking students expect it. | §7 |
| D5 | Teachers/schools pushing exam dates | No direct integration in v1. A teacher can be given edit access to the student's sheet, or share a class template that students copy. | Decided | Keeps grade data private per student. | §3.2, §8.1 |
| D6 | Product name and logo | **Working title "StudyPlanner"** (placeholder, English) — final name and logo to be chosen later; all strings use a single `appName` constant so renaming is trivial. | Deferred | Not a technical decision. | Header, PWA manifest |
| D7 | Who fills the sheet? | The **student** owns and edits it by default; parents/teachers can be added as editors through normal Google sharing. The app does not care who edits. | Decided | Simplest; no roles to build. | F0, §8.1 |
| D8 | One sheet per student or a class sheet? | **One sheet per student.** Class sheets are out of scope. | Decided | A shared sheet would expose other students' grades. | §1.4, §8.1 |
| D9 | Grade rules and bagrut split | Scale 0–100; weights per grade row; pass mark default 55 (per subject configurable). **Bagrut final grade = 70% bagrut exam + 30% school grade**, i.e., default `schoolWeight = 0.3`, still editable per subject in Settings/sheet. | Decided | Rule stated by the product owner. Secondary sources conflicted (50/50 vs. 30/70), so keep it editable if a subject differs. | §7.1, §9.8 |
| D10 | 7-day notice format | **One notice per test, grouped by day** (mandatory) + optional **weekly digest** (P1). Tests already < 7 days away notify once, immediately. | Decided | Meets "notice a week before every test" without spamming. | F4, §9.5 |
| D11 | Timetable changes during the year | `validFrom`/`validTo` for semester changes, a `date` column for one-off overrides, and a Holidays tab. | Decided | Covers substitutes and vacations without a complex editor. | §8.1, §9.2 |
| D12 | Chart direction in Hebrew | Time axis runs in the **reading direction** (right-to-left); numbers stay LTR. | Decided | Consistent with the mirrored layout. | §7 |
| D20 | School exam calendar and separate grades sheet | The app accepts the **school's official published exam calendar** as a source of test dates (read-only, shared per grade, no personal data), plus a **grades-only sheet**. This refines D8 (one sheet per student): the calendar is shared by the whole grade, the grades sheet stays per student. | Decided | Product owner: the official school calendar is the exam-date source; grades come from a student-only sheet. | F0, §8.1 |
| D21 | Manual grades and timetable | Grades can be **entered by hand without a weight** (always 1) and the timetable **by hand** (several weekdays per entry) for students who have no file. Data stays on the device; hand-entered data replaces the sample data. | Decided | Product owner request: some students cannot provide a sheet. | F0.1, F8.1 |
| D22 | Timetable from a file | The app accepts a **timetable CSV** (same columns as the Schedule tab) uploaded in the timetable dialog, in addition to a Schedule tab and hand entry. Importing replaces the previous import. Files with personal data (teacher names) are not stored in the repository. | Decided | Product owner supplied a timetable as screenshots and asked for a file the site can import. | F0.1 |
| D23 | Own tasks for today | Students can add their own tasks for today to Today's Mission (title, optional subject, 5–240 min). They are shown after the suggested top-3, are device-local, and expire the same day. | Decided | Product owner request. | S1, §4 |
| D24 | Exam calendar filter | The school calendar is filtered to **the subjects in the student's timetable** by default, and block exams ("גוש א׳"/"גוש ב׳") follow the student's track: **block ב׳ = software engineering, biomedicine, biotechnology, computer science; every other track = block א׳**; alternatives are a hand-picked subject list and "all tests". With no timetable nothing is hidden. | Decided | Product owner request: show only the tracks that are mine. | F0 |
| D25 | Study videos screen (Apify) | A **second screen** (`#videos`) shows the most-viewed YouTube explanations for the next test's subject, fetched through **Apify** (`streamers/youtube-scraper`) with the student's own API token. The token stays on the device and is sent only to `api.apify.com`; a search runs only on a button press (it uses the student's Apify credit); results are cached per query. | Decided | Course bonus task: add a dashboard screen fed by Apify. | §4 |
| D19 | Google access scope | **`spreadsheets.readonly` from the start** (sign in with Google, paste the sheet link/ID). No Picker/`drive.file` spike. **Start Google OAuth app verification early** (consent screen, privacy policy). | Decided | Product owner's choice: simplest sign-in flow; accepts verification lead time (§10.1, §11). | §10.1, §11, F0, §12 |
| D13 | How much on the main dashboard? | **Minimal:** 3 main widgets (next test hero + countdown, today's schedule, Today's Mission) + 7-day banner; other widgets move to their own pages. | Decided | Answered by the product owner; keeps the phone view calm. | §4 |
| D14 | Dashboard by age/level | **Simple mode for grades 7–9**, full mode from grade 10. Simple mode hides the bagrut tracker, predicted final grade, readiness score and what-if slider; grade insights otherwise stay the same. | Decided | Answered by the product owner. | §4.2 |
| D15 | Behind-status tone | **Gentle:** soft labels (On track / A bit tight / Needs a boost), amber not red, always a small next step; red only for time pressure. | Decided | Answered by the product owner. | §4.3, §6.4, §9.3 |
| D16 | Adding tests without the sheet | **Local quick add** ("Local" tag, device-only, never written to the sheet); replaced by a matching sheet row on sync. | Decided | Answered by the product owner; keeps the sheet read-only. | F1 |
| D17 | Main device | **Phone first**; desktop is the same widgets in a wider two-column layout. | Decided | Answered by the product owner. | §4, §11 |
| D18 | 7-day notice on the dashboard | **Top banner** listing tests in the next 7 days. | Decided | Answered by the product owner. | §4, F4 |

**Open items:** none blocking v1 design. Two are consciously **deferred** (D1 bagrut templates, D6 final name/logo) and one is a **gate for later** (legal review before any backend, D3). The remaining risk is external: Google's OAuth verification for the `spreadsheets.readonly` scope (D19) takes calendar time, so it should be started in M0.

---

## 14. Sources and Verification Log

Checked on 2026-09-20.

| Claim | Source | Result |
|---|---|---|
| Sheets API read quotas | [Google Sheets API usage limits](https://developers.google.com/sheets/api/limits) | 300 read requests/min/project, 60/min/user/project, no daily cap. |
| OAuth scope classification | [Google Sheets API scopes](https://developers.google.com/sheets/api/scopes) | `spreadsheets` and `spreadsheets.readonly` are Sensitive; `drive.file` Non-sensitive; `drive` and `drive.readonly` Restricted. |
| Periodic Background Sync | [MDN — Periodic Background Synchronization API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API) | Experimental, not Baseline; Chrome requires an installed web app and uses site engagement. |
| Bagrut structure | [Wikipedia — Bagrut certificate](https://en.wikipedia.org/wiki/Bagrut_certificate) and other secondary sources | Pass mark 55 widely cited; school/exam split reported inconsistently (50/50 vs. 30/70). **Default set to 70% exam / 30% school by the product owner (D9)**; editable per subject. |
| Ministry booklet | [Ministry of Education 2025 booklet](https://meyda.education.gov.il/files/pop/0files/english/Chativa-Elyona/Bagrut/updates/5pointsbooklet2025.pdf) | Navigational; did not state the grade formula. |
| iOS Web Push requires installed PWA (16.4+) | Widely documented by Apple/WebKit; **not re-verified in this pass** | Keep the in-app banner and email as the guaranteed channels. |
| `drive.file` + Picker with Sheets API | Not verified | Not needed: D19 uses `spreadsheets.readonly`. |
