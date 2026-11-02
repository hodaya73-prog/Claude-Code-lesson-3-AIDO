/* Google Sheets reading + validation (SPEC F0, §8.1, §9.7).
   Prototype mode: reads tabs through the sheet's public link ("anyone with the link can view" or
   "published to the web"). Real sign-in with the spreadsheets.readonly scope (Decision D19) comes later.

   Three kinds of source:
   1. personal sheet  — tabs Schedule / Exams / Grades (+ Subjects, Holidays)
   2. school exam calendar — an official published sheet, one tab per grade, columns: day, date, exam text
   3. student grades sheet — grades only (subject + grade, optional date / title / weight)  */
(function () {
  const SP = (window.SP = window.SP || {});
  const L = SP.logic;

  // ---------- CSV ----------
  // Files saved from Excel may start with a BOM and use ";" or a tab instead of ","
  const stripBom = (s) => String(s).replace(/^﻿/, '');
  function detectDelimiter(text) {
    const first = stripBom(text).split(/\r?\n/).find((l) => l.trim() !== '') || '';
    const count = (ch) => first.split(ch).length - 1;
    const best = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
    return count(best) > 0 ? best : ',';
  }

  function parseCSV(text, delim) {
    text = stripBom(text);
    delim = delim || ',';
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === delim) {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else field += c;
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows; // blank rows are kept so row numbers match the sheet; toObjects() skips them
  }

  // ---------- header aliases (English or Hebrew, SPEC §8.1) ----------
  const ALIASES = {
    date: ['date', 'תאריך'],
    time: ['time', 'שעה'],
    subject: ['subject', 'מקצוע'],
    title: ['title', 'exam', 'כותרת', 'שם', 'שם המבחן', 'מבחן', 'נושא המבחן'],
    type: ['type', 'סוג'],
    weight: ['weight', 'משקל'],
    difficulty: ['difficulty', 'קושי'],
    topics: ['topics', 'נושאים'],
    notes: ['notes', 'הערות'],
    weekday: ['weekday', 'day', 'יום'],
    period: ['period', 'שיעור'],
    start: ['start', 'התחלה'],
    end: ['end', 'סיום'],
    room: ['room', 'חדר'],
    teacher: ['teacher', 'מורה'],
    grade: ['grade', 'score', 'mark', 'ציון'],
    name: ['name', 'שם המקצוע'],
    color: ['color', 'צבע'],
    targetaverage: ['targetaverage', 'ממוצע יעד'],
    validfrom: ['validfrom'],
    validto: ['validto'],
  };
  const aliasToKey = {};
  for (const [key, list] of Object.entries(ALIASES)) list.forEach((a) => (aliasToKey[a.toLowerCase()] = key));
  const headerKey = (h) => aliasToKey[String(h).trim().toLowerCase()] || String(h).trim().toLowerCase();

  // Some sheets have title rows above the header. Find the first row that contains all required columns.
  function toObjects(rows, required) {
    let h = 0;
    if (required && required.length) {
      h = rows.findIndex((r) => required.every((k) => r.map(headerKey).includes(k)));
      if (h < 0) return null; // columns not found
    }
    if (!rows.length) return [];
    const headers = rows[h].map(headerKey);
    if (headers.every((k) => k === '')) return []; // only blank rows
    return rows
      .slice(h + 1)
      .map((r, i) => {
        const o = { _row: h + i + 2 };
        headers.forEach((k, j) => (o[k] = (r[j] || '').trim()));
        o._blank = r.every((c) => String(c).trim() === '');
        return o;
      })
      .filter((o) => !o._blank);
  }

  // ---------- cell parsers ----------
  function parseDate(s) {
    s = String(s).trim();
    let y, m, d;
    let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) [, y, m, d] = match;
    else {
      // Israeli order D/M/Y (also D.M.Y and D-M-Y); ambiguous with M/D — use YYYY-MM-DD in your own sheet
      match = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
      if (!match) return null;
      [, d, m, y] = match;
      if (y.length === 2) y = '20' + y;
    }
    y = +y; m = +m; d = +d;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return L.ymd(dt);
  }

  // "08:45", "8:45:00" and — because Google formats time cells by the sheet's locale — "1:00:00 PM"
  const parseTime = (s) => {
    const m = String(s).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/);
    if (!m) return null;
    let h = +m[1];
    if (m[3]) {
      if (h < 1 || h > 12) return null;
      const pm = m[3].toLowerCase() === 'pm';
      h = h % 12 + (pm ? 12 : 0);
    }
    if (h > 23 || +m[2] > 59) return null;
    return L.pad(h) + ':' + m[2];
  };

  const WEEKDAYS = {
    sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7,
    'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ש': 7,
    'ראשון': 1, 'שני': 2, 'שלישי': 3, 'רביעי': 4, 'חמישי': 5, 'שישי': 6, 'שבת': 7,
  };
  function parseWeekday(s) {
    s = String(s).trim().toLowerCase().replace(/^יום\s*/, '').replace(/[׳'`.]/g, '');
    if (/^[1-7]$/.test(s)) return +s;
    return WEEKDAYS[s] || WEEKDAYS[s.slice(0, 3)] || null;
  }

  const TYPES = {
    quiz: 'quiz', test: 'test', exam: 'exam', project: 'project', bagrut: 'bagrut',
    'בוחן': 'quiz', 'מבחן': 'test', 'בחינה': 'exam', 'פרויקט': 'project', 'בגרות': 'bagrut',
  };
  const parseType = (s) => TYPES[String(s).trim().toLowerCase()] || (s ? null : 'test');

  const PALETTE = ['#7C6CFF', '#3DDBD9', '#F6A04D', '#E76F9A', '#4FB477', '#5B9DF5', '#C08BE8', '#E3C24A', '#F0785A', '#7FB7A4'];

  // ---------- Hebrew text helpers ----------
  // strip niqqud, quotes and geresh/gershayim so "תנ"ך", "תנ״ך" and "תנך" compare equal
  const norm = (s) =>
    String(s).replace(/[֑-ׇ]/g, '').replace(/["'׳״`´]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

  // keyword (normalised) → display name. Order matters: first match wins.
  const SUBJECT_WORDS = [
    // spelling variants (the second entry of a pair) are real ones found in the school's calendar
    ['חינוך תעבורתי', 'חינוך תעבורתי'], ['ח.תעבורתי', 'חינוך תעבורתי'], ['הנדסת תוכנה', 'הנדסת תוכנה'], ['מדעי המחשב', 'מדעי המחשב'],
    ['ביורפואה', 'ביורפואה'], ['ביוטכנולוגיה', 'ביוטכנולוגיה'], ['ביוטכנולגיה', 'ביוטכנולוגיה'], ['ביוטכנלוגיה', 'ביוטכנולוגיה'],
    ['חנג', 'חנ״ג'],
    ['פסיכולוגיה', 'פסיכולוגיה'], ['פסיכולגיה', 'פסיכולוגיה'],
    ['פילוסופיה', 'פילוסופיה'], ['פילוספיה', 'פילוסופיה'],
    ['היסטוריה', 'היסטוריה'], ['אזרחות', 'אזרחות'], ['ספרות', 'ספרות'], ['אנגלית', 'אנגלית'], ['מתמטיקה', 'מתמטיקה'],
    ['חדוא', 'חדו״א'], ['לשון', 'לשון'], ['תנך', 'תנ״ך'], ['ביולוגיה', 'ביולוגיה'], ['ביולגיה', 'ביולוגיה'], ['פיזיקה', 'פיזיקה'], ['כימיה', 'כימיה'],
    ['עברית', 'עברית'], ['גוש א', 'גוש א׳'], ['גוש ב', 'גוש ב׳'],
  ];
  function canonicalSubject(text) {
    const n = norm(text);
    for (const [k, v] of SUBJECT_WORDS) if (n.includes(k)) return v;
    return null;
  }
  // For a subject the vocabulary does not know ("מתכונת משפטים", "בגרות חינוך גופני (כלל השכבה)"): drop the words that describe
  // the exam rather than the subject, so it matches the same subject elsewhere (timetable, grades) and is not named "בגרות משפטים".
  const EXAM_WORD = /(^|\s)(בגרות|מתכונת|מבחן|בוחן|מסכם|מעבדה|פנימית|מועד|נוסף|ב['׳]?)(?=\s|$)/g;
  function cleanSubject(text) {
    let s = String(text).replace(/\([^)]*\)/g, ' ').replace(/[-–—.,/]/g, ' ').replace(/\d+/g, ' ');
    for (let i = 0; i < 3; i++) s = s.replace(EXAM_WORD, '$1'); // repeated: removing one word can expose the next
    s = s.replace(/\s+/g, ' ').trim();
    return s || String(text).trim();
  }
  // Tracks (מגמות) are grouped into two exam blocks: block ב׳ = software engineering, biomedicine,
  // biotechnology and computer science; every other track is block א׳ (rule given by the product owner).
  const B_TRACKS = ['הנדסת תוכנה', 'ביורפואה', 'ביוטכנולוגיה', 'מדעי המחשב', 'מדמח'];
  const flat = (s) => norm(s).replace(/[-\s]/g, '');
  const trackOf = (subject) => B_TRACKS.find((k) => flat(subject).includes(flat(k))) || null;
  // Which block do these timetable subjects belong to? { block: 'א' | 'ב', track: the block-ב track found, if any }
  function blockOfSubjects(subjects) {
    const track = subjects.map(trackOf).find(Boolean) || null;
    return { block: track ? 'ב' : 'א', track };
  }
  const sameSubject = (a, b) => norm(a) === norm(b) || (canonicalSubject(a) && canonicalSubject(a) === canonicalSubject(b));

  // ---------- 1) personal sheet: normalisation with row-level issues (SPEC F0 "Sync issues") ----------
  // Timetable rows (used by the personal sheet's Schedule tab and by the timetable file import)
  function parseScheduleRows(rows, tabName) {
    const issues = [];
    const schedule = [];
    const bad = (row, key) => issues.push({ tab: tabName, row, key });
    for (const r of toObjects(rows) || []) {
      const wd = r.date ? null : parseWeekday(r.weekday);
      const date = r.date ? parseDate(r.date) : null;
      if (!wd && !date) { bad(r._row, 'badWeekday'); continue; }
      const type = (r.type || 'lesson').toLowerCase() === 'off' ? 'off' : 'lesson';
      const start = parseTime(r.start), end = parseTime(r.end);
      if (type === 'lesson' && (!start || !end)) { bad(r._row, 'badTime'); continue; }
      if (type === 'lesson' && L.timeToMin(end) <= L.timeToMin(start)) { bad(r._row, 'badTime'); continue; }
      if (type === 'lesson' && !r.subject) { bad(r._row, 'noSubject'); continue; }
      schedule.push({
        weekday: wd, date, period: r.period, start, end, subject: r.subject, room: r.room,
        teacher: r.teacher, type, validFrom: parseDate(r.validfrom || '') || null, validTo: parseDate(r.validto || '') || null,
      });
    }
    return { schedule, issues };
  }

  function normalize(tabs) {
    const issues = [];
    const bad = (tab, row, key) => issues.push({ tab, row, key });
    const subjectNames = new Set();

    const sched = parseScheduleRows(tabs.Schedule || [], 'Schedule');
    const schedule = sched.schedule;
    issues.push(...sched.issues);
    schedule.forEach((l) => l.subject && subjectNames.add(l.subject));

    const exams = [];
    for (const r of toObjects(tabs.Exams || []) || []) {
      const date = parseDate(r.date);
      if (!date) { bad('Exams', r._row, 'badDate'); continue; }
      if (!r.subject) { bad('Exams', r._row, 'noSubject'); continue; }
      const time = r.time ? parseTime(r.time) : '08:00';
      if (!time) { bad('Exams', r._row, 'badTime'); continue; }
      const type = parseType(r.type);
      if (!type) { bad('Exams', r._row, 'badType'); continue; }
      subjectNames.add(r.subject);
      const startsAt = L.parseYmd(date);
      const [h, m] = time.split(':').map(Number);
      startsAt.setHours(h, m, 0, 0);
      exams.push({
        id: 'sheet:' + r._row + ':' + r.subject + ':' + date,
        source: 'sheet', subject: r.subject, title: r.title || r.subject, type, date, time, startsAt,
        weight: Math.min(5, Math.max(1, +r.weight || 3)),
        difficulty: Math.min(5, Math.max(1, +r.difficulty || 3)),
        topics: r.topics ? r.topics.split(/[,;،]/).map((t) => t.trim()).filter(Boolean) : [],
        notes: r.notes || '',
      });
    }

    const g = parseGradeRows(tabs.Grades || [], 'Grades', { requireDate: true });
    issues.push(...g.issues);
    g.grades.forEach((x) => subjectNames.add(x.subject));

    const subjects = [];
    for (const r of toObjects(tabs.Subjects || []) || []) {
      if (!r.name) continue;
      subjectNames.add(r.name);
      subjects.push({ name: r.name, color: r.color || null, targetAverage: parseFloat(r.targetaverage) || null });
    }
    [...subjectNames].forEach((n) => {
      if (!subjects.some((s) => s.name === n)) subjects.push({ name: n, color: null, targetAverage: null });
    });
    subjects.forEach((s, i) => (s.color = s.color || PALETTE[i % PALETTE.length]));

    const holidays = [];
    for (const r of toObjects(tabs.Holidays || []) || []) {
      const date = parseDate(r.date);
      if (!date) { bad('Holidays', r._row, 'badDate'); continue; }
      holidays.push({ date, name: r.name || '', type: (r.type || 'off').toLowerCase() === 'short' ? 'short' : 'off' });
    }
    return { data: { subjects, schedule, exams, grades: g.grades, holidays }, issues };
  }

  // ---------- 3) grades (used by the personal sheet's Grades tab and by the grades-only sheet) ----------
  // requireDate: personal sheet needs a date (SPEC §8.1); a grades-only sheet may omit it (rows keep their order).
  function parseGradeRows(rows, tabName, opts) {
    const issues = [];
    const grades = [];
    const objs = toObjects(rows, ['subject', 'grade']);
    if (!objs) return { grades, issues, missingColumns: rows.length > 0 };
    for (const r of objs) {
      const raw = String(r.grade).replace(',', '.').trim();
      if (raw === '' && !r.subject) continue; // empty row
      if (!r.subject) { issues.push({ tab: tabName, row: r._row, key: 'noSubject' }); continue; }
      if (raw === '') continue; // grade not entered yet
      const grade = parseFloat(raw);
      if (!isFinite(grade) || grade < 0 || grade > 100) { issues.push({ tab: tabName, row: r._row, key: 'badGrade' }); continue; }
      let date = '';
      if (r.date) {
        date = parseDate(r.date);
        if (!date) { issues.push({ tab: tabName, row: r._row, key: 'badDate' }); continue; }
      } else if (opts && opts.requireDate) { issues.push({ tab: tabName, row: r._row, key: 'badDate' }); continue; }
      const weight = r.weight === '' || r.weight === undefined ? 1 : parseFloat(r.weight);
      if (!isFinite(weight) || weight <= 0) { issues.push({ tab: tabName, row: r._row, key: 'badWeight' }); continue; }
      grades.push({ date, subject: opts && opts.canonical ? canonicalSubject(r.subject) || r.subject.trim() : r.subject, title: r.title || '', grade, weight });
    }
    return { grades, issues, missingColumns: false };
  }

  // ---------- 2) school exam calendar (official published sheet) ----------
  // Rows look like: "יום חמישי,15/10/26,י״א - מבחן ספרות". Title rows, section rows ("מחצית א") and blank rows are skipped.
  const GRADE_PREFIX = /^\s*(?:יוד|י["״]?[אב])\s*[-–—]?\s*/;

  function examKind(text) {
    const n = norm(text);
    const moedB = /מועד ב|מועד נוסף/.test(n);
    if (n.includes('בגרות')) return { type: 'bagrut', weight: 5, difficulty: 4, moed: moedB ? 'B' : 'A' };
    // a second sitting (מועד ב' / מועד נוסף) is recognised for every kind of exam; only a bagrut states its first sitting (A)
    const moed = moedB ? 'B' : null;
    if (n.includes('מתכונת')) return { type: 'exam', weight: 4, difficulty: 4, moed };
    if (n.includes('בוחן')) return { type: 'quiz', weight: 2, difficulty: 2, moed };
    if (n.includes('מעבדה')) return { type: 'project', weight: 2, difficulty: 3, moed };
    return { type: 'test', weight: 3, difficulty: 3, moed };
  }

  function parseExamCalendar(rows) {
    const objs = toObjects(rows, ['date', 'title']);
    if (!objs) return { exams: [], issues: [], missingColumns: true };
    const exams = [];
    const issues = [];
    for (const r of objs) {
      const date = parseDate(r.date);
      if (!date) continue; // title rows, "מחצית א", blank rows
      const raw = r.title.replace(GRADE_PREFIX, '').trim();
      if (!raw) continue;
      const subject = canonicalSubject(raw) || cleanSubject(raw);
      const kind = examKind(raw);
      const startsAt = L.parseYmd(date);
      startsAt.setHours(8, 0, 0, 0); // the calendar gives no time of day
      exams.push({
        id: 'cal:' + date + ':' + norm(raw), source: 'calendar', subject, title: raw, date, time: '08:00', noTime: true, startsAt,
        type: kind.type, moed: kind.moed || null, weight: kind.weight, difficulty: kind.difficulty, topics: [], notes: '',
      });
    }
    exams.sort((a, b) => a.startsAt - b.startsAt || a.title.localeCompare(b.title));
    return { exams, issues, missingColumns: false };
  }

  // ---------- links & fetching ----------
  // published: https://docs.google.com/spreadsheets/d/e/2PACX-…/pubhtml?gid=…   (File → Share → Publish to web)
  // sheet:     https://docs.google.com/spreadsheets/d/<id>/edit?gid=…            (shared as "anyone with the link")
  function parseLink(input) {
    const s = String(input || '').trim();
    const gidMatch = s.match(/[?&#]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : null;
    let m = s.match(/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
    if (m) return { kind: 'published', id: m[1], gid };
    m = s.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (m) return { kind: 'sheet', id: m[1], gid };
    if (/^[a-zA-Z0-9-_]{25,}$/.test(s)) return { kind: 'sheet', id: s, gid: null };
    return null;
  }

  async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('http ' + res.status);
    const text = await res.text();
    if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('no_access');
    return text;
  }

  function unescapeJs(s) {
    return s
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\(.)/g, '$1');
  }

  // Tab names of a published sheet, read from its pubhtml page
  async function listPublishedTabs(id) {
    const res = await fetch('https://docs.google.com/spreadsheets/d/e/' + id + '/pubhtml');
    if (!res.ok) throw new Error('http ' + res.status);
    const html = await res.text();
    const tabs = [];
    const re = /items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"/g;
    let m;
    while ((m = re.exec(html))) tabs.push({ name: unescapeJs(m[1]), gid: m[2] });
    return tabs;
  }

  function csvUrl(link, sel) {
    if (link.kind === 'published') return 'https://docs.google.com/spreadsheets/d/e/' + link.id + '/pub?gid=' + sel.gid + '&single=true&output=csv';
    const q = sel.gid != null ? '&gid=' + sel.gid : sel.name ? '&sheet=' + encodeURIComponent(sel.name) : '';
    return 'https://docs.google.com/spreadsheets/d/' + link.id + '/gviz/tq?tqx=out:csv' + q;
  }

  // Rows of one tab. sel = { gid } or { name }. Returns null when a named tab does not exist (published sheets).
  async function fetchRows(link, sel, publishedTabs) {
    let s = sel;
    if (link.kind === 'published' && s.gid == null) {
      const tabs = publishedTabs || (await listPublishedTabs(link.id));
      const found = tabs.find((t) => t.name === s.name);
      if (!found) return null;
      s = { gid: found.gid };
    }
    return parseCSV(await fetchText(csvUrl(link, s)));
  }

  // ---------- Airtable (timetable table, read with a personal access token) ----------
  // link: https://airtable.com/appXXXXXXXXXXXXXX/tblXXXXXXXXXXXXXX/… (the address of the table in the browser)
  function parseAirtableLink(input) {
    const s = String(input || '');
    const base = s.match(/\b(app[a-zA-Z0-9]{14})\b/);
    const table = s.match(/\b(tbl[a-zA-Z0-9]{14})\b/);
    return base && table ? { baseId: base[1], tableId: table[1] } : null;
  }

  // Rows (header row first, like a CSV) from every record of the table; field names are the column names.
  async function loadAirtable(link, token) {
    const records = [];
    let offset = '';
    do {
      const url = 'https://api.airtable.com/v0/' + link.baseId + '/' + link.tableId + '?pageSize=100' + (offset ? '&offset=' + encodeURIComponent(offset) : '');
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error('http ' + res.status);
      const body = await res.json();
      records.push(...(body.records || []));
      offset = body.offset || '';
    } while (offset);
    const headers = [...new Set(records.flatMap((r) => Object.keys(r.fields || {})))];
    const cell = (v) => (v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? v.name || '' : String(v));
    return [headers, ...records.map((r) => headers.map((h) => cell(r.fields[h])))];
  }

  // Google returns the FIRST tab when a tab name doesn't exist, so check the headers to detect that.
  // `not` lists columns that mean "this is a different tab" (e.g. the Exams tab must not look like a timetable or a grade list)
  function hasHeaders(rows, keys, not) {
    if (!rows || !rows.length) return false;
    const headers = rows[0].map(headerKey);
    return keys.every((k) => headers.includes(k)) && !(not || []).some((k) => headers.includes(k));
  }

  // Any one of Schedule / Exams / Grades is enough (e.g. a sheet with only a timetable); Subjects and Holidays are optional.
  const TABS = {
    Schedule: { keys: ['weekday', 'start'] },
    Exams: { keys: ['date', 'subject'], not: ['weekday', 'start', 'grade'] },
    Grades: { keys: ['grade', 'subject'], not: ['weekday', 'start'] },
    Subjects: { keys: ['name'], not: ['weekday', 'start', 'grade'] },
    Holidays: { keys: ['date'], not: ['weekday', 'start', 'subject', 'grade'] },
  };

  async function loadSheet(link) {
    const tabs = {};
    const missing = [];
    let lastError = null;
    const published = link.kind === 'published' ? await listPublishedTabs(link.id) : null;
    for (const [tab, spec] of Object.entries(TABS)) {
      try {
        const rows = await fetchRows(link, { name: tab }, published);
        if (hasHeaders(rows, spec.keys, spec.not)) tabs[tab] = rows;
        else missing.push(tab);
      } catch (e) {
        lastError = e;
        missing.push(tab);
      }
    }
    if (!Object.keys(tabs).length && lastError) throw lastError; // nothing readable at all → access problem
    return { tabs, missing };
  }

  // Load one chosen tab of an exam-calendar or grades-only link. Returns { rows, tabs, tab }.
  async function loadSingleTab(link, chosenGid) {
    let tabs = [];
    let gid = chosenGid || link.gid;
    if (link.kind === 'published') {
      tabs = await listPublishedTabs(link.id);
      if (!gid && tabs.length) gid = tabs[0].gid;
      if (!gid) throw new Error('no_tabs');
    }
    const rows = await fetchRows(link, { gid: gid || null }, tabs);
    const tab = tabs.find((t) => t.gid === String(gid));
    return { rows, tabs, gid: gid ? String(gid) : null, tabName: tab ? tab.name : '' };
  }

  Object.assign(SP, {
    sheets: {
      parseCSV, toObjects, parseDate, parseTime, parseWeekday, normalize, PALETTE, norm, canonicalSubject, sameSubject, blockOfSubjects,
      parseGradeRows, parseExamCalendar, parseScheduleRows, detectDelimiter, parseLink, listPublishedTabs, loadSheet, loadSingleTab, fetchRows,
      parseAirtableLink, loadAirtable,
      // kept for tests / callers that only need an id
      extractId: (s) => { const l = parseLink(s); return l ? l.id : null; },
    },
  });
})();
