# Practice.md — איך עובדים על הפרויקט

כללי העבודה של **StudyPlanner** (דשבורד ללימודים לתלמידים, עברית/אנגלית). כל אדם — וגם Claude Code — שעובד על הפרויקט פועל לפי הכללים כאן.
הקובץ הזה הוא חלק מ"הלולאה": [`SPEC.md`](SPEC.md) אומר *מה* בונים, [`architecture.md`](architecture.md) אומר *איך ואיפה*, והקובץ הזה אומר *איך עובדים*.

## 1. פרטי המאגר

| נושא | ערך |
|---|---|
| מאגר (`origin`) | https://github.com/hodaya73-prog/Claude-Code-lesson-3-AIDO.git |
| ענף ראשי | `master` — **מוגן**: משנים אותו רק דרך Pull Request שבו הבדיקה `tests` ירוקה |
| טכנולוגיה | HTML + CSS + JavaScript רגיל, בלי Node ובלי שלב build (החלטה D26) |
| אתר חי | https://hodaya73-prog.github.io/Claude-Code-lesson-3-AIDO/ — מתעדכן אחרי מיזוג ל-`master` |
| מסמכי הפרויקט | [`SPEC.md`](SPEC.md) (מפרט + יומן החלטות D1–D28), [`architecture.md`](architecture.md), [`README.md`](README.md), [`CLAUDE.md`](CLAUDE.md) (מה Claude קורא לפני שהוא כותב), [`tests/README.md`](tests/README.md), [`evals/README.md`](evals/README.md) |

## 2. כלל הזהב: שום דבר לא נכנס ל-`master` בלי שער

**כל שינוי עובר: כרטיס (issue) ← ענף ← commits ← Pull Request ← בדיקות ירוקות ← מיזוג.**
אין `git push` ישיר ל-`master` — GitHub דוחה אותו (ראו סעיף 8).

1. **כרטיס.** יש issue לכל עבודה (ראו סעיף 6). עבודה קטנה מאוד (שגיאת כתיב) יכולה להיות בלי כרטיס.
2. **ענף** מ-`master` העדכני, בשם `סוג/נושא-קצר`:
   `feature/` יכולת חדשה · `fix/` תיקון באג · `design/` עיצוב · `spec/` שלב מהמפרט · `chore/` תחזוקה, כלים, תיעוד.
3. **commits קטנים** (סעיף 5) ו-`git push -u origin <ענף>`. ה-hook המקומי מריץ את הבדיקות לפני כל push.
4. **Pull Request** לפי התבנית (`.github/pull_request_template.md`), עם `Closes #<מספר>` כדי שהכרטיס ייסגר לבד.
5. **שער:** ה-job בשם `tests` ב-GitHub Actions חייב להיות ירוק. אדום = לא ממזגים; מתקנים ודוחפים שוב לאותו ענף.
6. **מיזוג** ב-*Squash and merge* (commit אחד לכל PR, בשם ה-PR), ומחיקת הענף. אחרי המיזוג האתר החי מתעדכן תוך כדקה.

```bash
git switch master && git pull
git switch -c fix/calendar-second-sitting
# ... עבודה, בדיקות, commits ...
git push -u origin fix/calendar-second-sitting
gh pr create --fill          # ממלא את התבנית; מוסיפים Closes #<מספר>
gh pr checks --watch         # מחכים ל-tests ירוק
gh pr merge --squash --delete-branch
```

## 3. הכלים: מה מריץ מה

| איפה | איך | מה זה עוצר |
|---|---|---|
| במחשב | `powershell -NoProfile -ExecutionPolicy Bypass -File tests/run.ps1` (כ-20 שניות) | אתכם, לפני ה-push |
| `git push` | `.githooks/pre-push` — מפעילים **פעם אחת בכל שכפול**: `git config core.hooksPath .githooks` | push עם בדיקות כושלות |
| GitHub | `.github/workflows/test.yml` על כל PR ועל כל מיזוג ל-`master` | מיזוג עם בדיקות כושלות |

הסקריפט `tests/run.ps1` מפעיל בדפדפן Chrome/Edge ללא חלון את `tests/` (בדיקות קוד) ואת `evals/` (איכות הפענוח על נתונים אמיתיים) ומחזיר קוד יציאה 1 אם משהו נכשל.

## 4. לפני שפותחים Pull Request — בדיקות

1. **`tests/run.ps1` חייב לעבור** (בדיקות + evals). אם נכשל — מתקנים. לא עוקפים.
2. **באג? קודם בדיקה שנכשלת**, רואים אותה נכשלת מהסיבה הנכונה, ורק אז מתקנים.
3. **בדיקה ידנית בדפדפן** של מה שהשתנה: `http://localhost:5173` (מפעילים `tools/serve.ps1`), בעברית (RTL) ובמסך של טלפון.
4. **טקסט חדש בממשק** נכתב בעברית **ובאנגלית** ב-`js/i18n.js` (`tests/i18n.test.js` נכשל אם אחת חסרה).
5. **מקורות חיצוניים** (Google Sheets, Airtable, Apify): מה שנבדק רק מול תגובה מדומה נכתב במפורש כ"לא נבדק מול שירות אמיתי" ב-PR.
6. **שינוי בפענוח לוח המבחנים?** מריצים את ה-eval ומעדכנים את הרצפה ב-`evals/calendar.eval.js` אם הציון השתפר (ראו `evals/README.md`).

## 5. הודעות commit

- **שפה:** אנגלית. **צורה:** משפט קצר בלשון ציווי, עד כ-70 תווים, בלי נקודה בסוף.
- **תוכן:** מה נוסף או תוקן ולא איך (`Add own tasks for today to Today's Mission`).
- **סוף ההודעה:** שורת שיתוף הפעולה עם Claude, כפי שהכלי מציין (`Co-Authored-By: Claude … <noreply@anthropic.com>`).
- commit אחד = שינוי לוגי אחד.

## 6. הלוח: כרטיסים, תוויות ואבני דרך

אין לנו לוח Projects של GitHub (ההרשאה לא ניתנה); **הלוח הוא רשימת ה-Issues עם תוויות ואבני דרך** — אותו מידע, בלי הרשאה נוספת.

- **אבן דרך (milestone)** = שלב מה-Roadmap ב-SPEC §12: `M0` תכנון, `M1` נתונים וליבה, `M2` תכנון וציונים, `M3` תזכורות, `M4` לוח שנה ואנליטיקה, `M5` בגרות וליטוש, `M6+` בהמשך.
- **סטטוס** (תווית אחת בכל רגע): `status: todo` → `status: doing` → `status: review` (יש PR) → נסגר = בוצע. `status: blocked` כשמחכים למשהו, עם הסבר בכרטיס.
- **עדיפות** (לפי מפתח העדיפויות ב-SPEC): `P0` חייב ב-v1 · `P1` כדאי ב-v1 · `P2` בהמשך.
- **סוג:** `enhancement`, `bug`, `tech-debt`, `documentation`, `test`, `design`, `accessibility`.
- **כרטיס טוב:** משפט אחד (מי, מה, למה), סעיף "מוכן כש…" עם רשימת סימון שאפשר לאמת, והפניה לסעיף ב-SPEC. התבניות ב-`.github/ISSUE_TEMPLATE/`.
- **מי בוחר מה הלאה:** הכרטיס הפתוח עם העדיפות הגבוהה ביותר באבן הדרך הנמוכה ביותר. מעבירים ל-`doing` ופותחים ענף.
- **הצגת הלוח:** `gh issue list --milestone "M4 — …" --label "status: doing"`.

## 7. מה נכנס ל-Git ומה לא

**נכנס:** `index.html`, `css/`, `js/`, `template/`, `tools/`, `tests/`, `evals/`, `.github/`, `.githooks/`, `.claude/launch.json`, `README.md`, `SPEC.md`, `architecture.md`, `CLAUDE.md`, `Practice.md`, `.gitignore`.

**לא נכנס** (`.gitignore`):

| נתיב | סיבה |
|---|---|
| `dist/` | קובץ שנוצר אוטומטית (`tools/build-artifact.ps1`) — אפשר לבנות מחדש בכל רגע |
| `personal/` | קבצים אישיים |

**מידע אישי לא עולה ל-GitHub לעולם:** מערכת שעות אישית (שמות מורים וחדרים), ציונים אמיתיים, אסימונים (Airtable/Apify) וקישורים לגיליונות פרטיים. נתוני בדיקה נכתבים עם שמות לדוגמה.

## 8. מה אסור בלי אישור מפורש

- דחיפה ישירה ל-`master`, `git push --force` או כל שכתוב היסטוריה (`reset --hard`, `rebase` על commits שכבר הועלו).
- מיזוג כשה-check `tests` אדום, או עקיפת השער (`--no-verify`).
- מחיקת ענפים או קבצים שלא נוצרו בסשן הנוכחי.
- הוספת תלות, כלי build או קבצים בינאריים לא מוסברים.
- שינוי הגדרות ההגנה של `master` (פרט למקרה חירום, ראו סעיף 9).

**ההגנה על `master` (החלטה D28):** נדרש Pull Request, נדרש ה-check `tests`, והכלל חל גם על מנהלי המאגר. אם ה-CI עצמו שבור ואי אפשר למזג —
מתקנים את ה-CI בענף נפרד; במקרה חירום בלבד מכבים את ההגנה זמנית ב-Settings ← Branches, ומדליקים אותה מיד אחרי.

## 9. תיעוד מתעדכן יחד עם הקוד — באותו PR

- `architecture.md` — מודול חדש, שירות חיצוני חדש, מפתח אחסון חדש או מגבלה חדשה.
- `SPEC.md` — החלטה חדשה (שורה ביומן, `D<מספר>`) או שינוי במאפיין.
- `README.md` — כל מה שמשתמש רואה או מפעיל.
- `tests/` — בדיקה לכל לוגיקה חדשה; `evals/` — נתונים מתויגים חדשים כשמופיעה ניסוח חדש בלוח המבחנים.

## 10. הערות טכניות

- **אזהרת `LF will be replaced by CRLF`:** תקינה ב-Windows ואינה שגיאה.
- **קידוד:** UTF-8. בקבצי JavaScript לא כותבים את התו `U+FFFD` ישירות — משתמשים ב-`String.fromCharCode(0xfffd)`.
- **העתק מקומי אחר:** `git pull` לפני שמתחילים לעבוד.
- **שרת הפיתוח** (`tools/serve.ps1`) מגיש גם תיקיות (`/tests/` ← `tests/index.html`), כמו GitHub Pages.
- **גרסה מאוחסנת (Artifact):** נבנית עם `tools/build-artifact.ps1` ומתפרסמת בנפרד; היא לא חלק מה-commit.

## 11. רשימת בדיקה מהירה לפני PR

- [ ] הענף נוצר מ-`master` עדכני, בשם `סוג/נושא`
- [ ] `tests/run.ps1` עובר (בדיקות + evals)
- [ ] באג: יש בדיקה שנכשלה לפני התיקון
- [ ] הפיצ'ר נבדק בדפדפן (עברית + טלפון); טקסט חדש בשתי השפות
- [ ] אין מידע אישי בקבצים ששונו (`git status`)
- [ ] `architecture.md` / `SPEC.md` / `README.md` עודכנו לפי הצורך
- [ ] ה-PR מקושר לכרטיס (`Closes #…`), וה-check `tests` ירוק לפני מיזוג
