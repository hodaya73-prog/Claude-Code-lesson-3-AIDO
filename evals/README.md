# evals/

An **eval** answers "how good is it?" for work a unit test cannot pin down. A test says *this input gives this output*; an
eval runs many real inputs through the code, reports a **score**, and a **floor** stops the score from sliding.

## Why this product needs one

`parseExamCalendar` reads free Hebrew text such as `י"ב - מתכונת פסיכולגיה` from the school's calendar and decides the subject,
the type (quiz / test / mock / bagrut) and whether it is a second sitting. The school's lines are messy: typos, extra words,
combined tracks, subjects nobody listed. A wrong answer is user-visible — a retake shown as a normal test, or a test hidden
because its subject is called `מתכונת משפטים` instead of `משפטים`.

## `calendar-parsing`

| | |
|---|---|
| Data | `calendar-parsing.tsv` — 183 distinct exam lines from the school's published calendar (grades י, י"א, י"ב, 2026/27); public text, no personal data |
| Labels | Written by reading the text, **not** by running the parser. 5 lines are marked `?` (ambiguous on their own) and are not scored |
| Score | Per field — subject, type, sitting — plus "all three right", over the 178 scored lines |
| Floor | In `calendar.eval.js` (`THRESHOLDS`): subject 95 %, type 98 %, sitting 95 %, overall 92 % |
| Run | `tests/run.ps1` (prints the scores and every miss), or open `/evals/` in the browser |

**History.** The first run scored subject 87.6 %, type 100 %, sitting 74.7 %, all three 63.5 %. It exposed two real bugs: a
second sitting (`מועד ב'` / `מועד נוסף`) was only recognised for bagrut exams (45 lines lost their marker), and unknown
subjects kept the exam word (`בגרות משפטים`). A comment had also swallowed the philosophy entries in the vocabulary. After
the fixes every field scored 100 %.

**Limits you should know.**
- The same 178 lines found the bugs and now confirm the fixes, so 100 % here is **not** a promise about lines we have not seen.
  Each new school year, add the new lines to the TSV *before* running the parser on them — that is the honest test.
- The labels are one person's reading. Disagree with one? Change the line and say why in the pull request.
- Only the school's calendar wording is covered. Another school's wording needs its own labelled lines.

### Changing the floor

- A change that **lowers** a score below its floor fails the gate. Fix the code, not the floor.
- A change that **raises** scores should raise the floor in the same pull request, so the gain is kept.
- Adding hard new lines may lower the score honestly; lower the floor only if you also open an issue for the misses.

## Agent behaviour — checked by hand

The product has no language model in it, so there is nothing to score there. The *agent that builds it* (Claude Code) is
governed by `CLAUDE.md` and `Practice.md`; `agent-rules.md` lists scenarios to try in a fresh session and what a correct
answer looks like. These are **not automated** and **have not been run yet**.
