# Practice.md — הנחיות הפרויקט: שמירה ועדכון ב-GitHub

מסמך זה מגדיר איך שומרים ומעדכנים את הפרויקט **StudyPlanner** (דשבורד ללימודים לתלמידים, עברית/אנגלית) ב-GitHub.
כל אדם — וגם Claude Code — שעובד על הפרויקט פועל לפי הכללים כאן.

## 1. פרטי המאגר

| נושא | ערך |
|---|---|
| מאגר (remote `origin`) | https://github.com/AsafKakun/Claude-Code-lesson-3-AIDO.git |
| ענף עבודה | `master` (מוגדר כ-upstream של `origin/master`) |
| תיקיית הפרויקט | `Claude Code lesson 3 AIDO` |
| טכנולוגיה | HTML + CSS + JavaScript רגיל, בלי Node ובלי שלב build |
| אתר חי (GitHub Pages) | https://asafkakun.github.io/Claude-Code-lesson-3-AIDO/ — המאגר ציבורי, ו-Pages מוגדר על `master` / שורש; האתר מתעדכן אוטומטית תוך כדקה אחרי כל `git push` |
| תיעוד | [`README.md`](README.md) (הפעלה ושימוש), [`SPEC.md`](SPEC.md) (מפרט ויומן החלטות D1–D24) |

## 2. כלל הזהב: כל עדכון נשמר ונדחף

**אחרי כל עדכון שהושלם ואומת — עושים commit ו-push מיד**, בלי לחכות ובלי לצבור כמה שינויים ל-commit אחד.

- "עדכון" הוא כל שינוי בקוד, ב-`SPEC.md`, ב-`README.md`, בתבניות או בכלים.
- עדכון נחשב "הושלם" רק אחרי שבדקתי אותו (ראו סעיף 4).
- כך ההיסטוריה ב-GitHub שקופה: כל commit הוא צעד אחד שאפשר להבין ולחזור אליו.
- הכלל שמור גם בזיכרון של Claude לפרויקט הזה, כך שהוא פועל אוטומטית.

## 3. תהליך העבודה, צעד אחר צעד

```bash
# 1. בודקים מה השתנה
git status --short

# 2. מוסיפים את כל השינויים המכוונים
git add -A

# 3. שומרים (commit) עם הודעה ברורה
git commit -m "הודעה קצרה באנגלית בלשון ציווי" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"

# 4. מעלים ל-GitHub
git push

# 5. מוודאים שהעלייה הצליחה
git log --oneline | head -1
```

אחרי ה-push מדווחים את ה-hash של ה-commit (למשל `e9ca9da`).

## 4. לפני שמעלים — בדיקות

1. **בדיקות אוטומטיות:** מפעילים את השרת המקומי ופותחים `tests.html`; חייבת להופיע כותרת `PASSED <מספר>` (כרגע 133 בדיקות).
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
   # ואז פותחים http://localhost:5173/tests.html
   ```
2. **בדיקה בדפדפן:** פותחים `http://localhost:5173`, ובודקים את הפיצ'ר שהשתנה (גם בעברית/RTL וגם במסך של טלפון).
3. **אם בדיקה נכשלת — לא דוחפים.** מתקנים קודם, או מדווחים במפורש על הכשל.
4. **מקורות Google Sheets:** מה שנבדק רק מול תגובה מדומה נכתב במפורש כ"לא נבדק מול גיליון אמיתי" (ב-`README.md` ובדיווח).

## 5. הודעות commit

- **שפה:** אנגלית. **צורה:** משפט קצר בלשון ציווי, עד כ-70 תווים, בלי נקודה בסוף.
- **תוכן:** מה נוסף או תוקן ולא איך (`Add own tasks for today to Today's Mission`).
- **סוף ההודעה:** שורת שיתוף הפעולה עם Claude:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- commit אחד = שינוי לוגי אחד.

דוגמאות אמיתיות מההיסטוריה:

| Commit | הודעה |
|---|---|
| `9dc1313` | Add SPEC.md for student study-planner dashboard |
| `dfe335d` | Build the dashboard prototype: exam-calendar and grades-sheet import |
| `70cb193` | Add manual grade entry (no weight) and manual timetable |
| `69bb451` | Add timetable file import (CSV) |
| `e54e1f2` | Add own tasks for today to Today's Mission |
| `90f2773` | Calendar filter: pick exam block (gush) from the student's track |
| `e9ca9da` | Add hosted Artifact build (single-file, no-network mode) |

## 6. מה נכנס ל-Git ומה לא

**נכנס:** `index.html`, `css/`, `js/`, `template/`, `tools/`, `tests.html`, `README.md`, `SPEC.md`, `Practice.md`, `.claude/launch.json`, `.gitignore`.

**לא נכנס** (מוגדר ב-`.gitignore`):

| נתיב | סיבה |
|---|---|
| `dist/` | קובץ שנוצר אוטומטית (`tools/build-artifact.ps1`) — אפשר לבנות מחדש בכל רגע |
| `personal/` | קבצים אישיים |

**מידע אישי לא עולה ל-GitHub לעולם.** למשל קובץ המערכת האישית `my-timetable.csv` (שמות מורים וחדרים) נשמר מחוץ לפרויקט, בתיקיית ההורדות. קישורים לגיליונות פרטיים, ציונים אמיתיים וסיסמאות או מפתחות — אסור לשמור בקוד או בקבצי הדוגמה.

## 7. תיעוד מתעדכן יחד עם הקוד

באותו commit של השינוי מעדכנים גם:

- `README.md` — אם השתנה משהו שמשתמש רואה או מפעיל.
- `SPEC.md` — אם התקבלה החלטה או השתנה מאפיין; מוסיפים שורה ליומן ההחלטות (`D<מספר>`).
- `tests.html` — בדיקה חדשה לכל לוגיקה חדשה (זיהוי, חישוב, פענוח קבצים).

## 8. מה אסור בלי אישור מפורש

- `git push --force` או כל שכתוב היסטוריה (`reset --hard`, `rebase` על commits שכבר הועלו).
- מחיקת ענפים או קבצים שלא נוצרו בסשן הנוכחי.
- הוספת קבצים גדולים או קבצים בינאריים לא מוסברים.
- דילוג על בדיקות או הוקים (`--no-verify`).

## 9. הערות טכניות

- **אזהרת `LF will be replaced by CRLF`:** תקינה ב-Windows ואינה שגיאה; ה-commit מצליח.
- **קידוד:** כל הקבצים ב-UTF-8. בקבצי JavaScript לא כותבים את התו `U+FFFD` ישירות — משתמשים ב-`String.fromCharCode(0xfffd)` (כלי הפרסום דוחה אותו).
- **העתק מקומי של הפרויקט (למשל במחשב אחר):** מושכים שינויים עם `git pull` לפני שמתחילים לעבוד ולפני שבודקים.
- **גרסה מאוחסנת (Artifact):** נבנית עם `tools/build-artifact.ps1` ומתפרסמת בנפרד מ-GitHub; היא לא חלק מה-commit.

## 10. רשימת בדיקה מהירה לפני push

- [ ] `tests.html` מציג `PASSED`
- [ ] הפיצ'ר נבדק בדפדפן (עברית + טלפון)
- [ ] אין מידע אישי בקבצים ששונו (`git status` נבדק)
- [ ] `README.md` / `SPEC.md` עודכנו במידת הצורך
- [ ] הודעת commit באנגלית + שורת `Co-Authored-By`
- [ ] בוצע `git push` וה-hash דווח
