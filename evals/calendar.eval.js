/* Eval: school-calendar text → subject / type / sitting.

   The parser (SP.sheets.parseExamCalendar) reads free Hebrew text such as "י"ב - מתכונת פסיכולגיה" and decides what
   the exam is. That is fuzzy work, so a handful of unit tests cannot say how good it is. This eval runs it over the
   labelled real lines in calendar-parsing.tsv and reports an accuracy per field.

   How the score is used: THRESHOLDS below are the floor. A change that makes the parser worse than the floor fails the
   gate; a change that makes it better should raise the floor in the same pull request (see evals/README.md). */

const THRESHOLDS = { subject: 95, type: 98, sitting: 95, overall: 92 }; // percent; measured baseline was 100 on all, see evals/README.md

const pad2 = (n) => String(n).padStart(2, '0');

async function runCalendarEval() {
  const tsv = await (await fetch('calendar-parsing.tsv')).text();
  const all = tsv.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#')).map((l) => {
    const [text, subject, type, sitting] = l.split('\t');
    return { text, subject, type, sitting };
  });
  const cases = all.filter((c) => c.subject !== '?');

  // one synthetic calendar row per case, each with its own date so the result can be matched back to its input
  const start = Date.UTC(2027, 0, 1);
  const dateOf = (i) => new Date(start + i * 86400000);
  const rows = [['יום', 'תאריך', 'מבחן']];
  cases.forEach((c, i) => {
    const d = dateOf(i);
    rows.push(['יום א׳', pad2(d.getUTCDate()) + '/' + pad2(d.getUTCMonth() + 1) + '/' + String(d.getUTCFullYear()).slice(2), c.text]);
  });
  const parsed = SP.sheets.parseExamCalendar(rows).exams;
  const byDate = new Map(parsed.map((e) => [e.date, e]));

  const miss = { subject: [], type: [], sitting: [] };
  let subjectOk = 0, typeOk = 0, sitOk = 0, allOk = 0, dropped = 0;
  cases.forEach((c, i) => {
    const d = dateOf(i);
    const e = byDate.get(d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()));
    if (!e) { dropped++; miss.subject.push(c.text + '  →  (line dropped)'); return; }
    const sitting = e.moed === 'A' || e.moed === 'B' ? e.moed : '-';
    const s = e.subject === c.subject, t = e.type === c.type, m = sitting === c.sitting;
    if (s) subjectOk++; else miss.subject.push(c.text + '  →  subject "' + e.subject + '", expected "' + c.subject + '"');
    if (t) typeOk++; else miss.type.push(c.text + '  →  type ' + e.type + ', expected ' + c.type);
    if (m) sitOk++; else miss.sitting.push(c.text + '  →  sitting ' + sitting + ', expected ' + c.sitting);
    if (s && t && m) allOk++;
  });

  const n = cases.length;
  const pct = (k) => Math.round((1000 * k) / n) / 10;
  const score = { subject: pct(subjectOk), type: pct(typeOk), sitting: pct(sitOk), overall: pct(allOk) };

  info('calendar-parsing: ' + n + ' scored lines (' + (all.length - n) + ' ambiguous lines skipped), ' + dropped + ' dropped by the parser');
  info('calendar-parsing scores — subject ' + score.subject + '%, type ' + score.type + '%, sitting ' + score.sitting + '%, all three right ' + score.overall + '%');
  for (const k of ['subject', 'type', 'sitting']) {
    if (miss[k].length) info(k + ' misses (' + miss[k].length + '):\n  ' + miss[k].join('\n  '));
  }
  for (const k of ['subject', 'type', 'sitting', 'overall']) {
    check('eval calendar-parsing: ' + k + ' accuracy ' + score[k] + '% ≥ floor ' + THRESHOLDS[k] + '%', score[k] >= THRESHOLDS[k], true);
  }
  return score;
}
