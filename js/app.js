/* Dashboard UI (SPEC §4): 7-day banner, next-test hero, today's schedule, Today's Mission, header grades chip.
   Data can come from up to three sources that are merged: a personal sheet, the school's exam calendar,
   and a grades-only sheet. With no source connected, sample data is shown. */
(function () {
  const SP = window.SP;
  const L = SP.logic;
  const SH = SP.sheets;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- storage (wrapped: may be blocked in private windows) ----------
  const store = {
    get(k, def) {
      try {
        const v = localStorage.getItem('sp.' + k);
        return v === null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('sp.' + k, JSON.stringify(v));
      } catch (e) { /* ignore */ }
    },
    del(k) {
      try {
        localStorage.removeItem('sp.' + k);
      } catch (e) { /* ignore */ }
    },
  };

  // The hosted (Artifact) build sets window.SP_HOSTED: network requests are blocked there, so sheets cannot be read.
  const HOSTED = !!window.SP_HOSTED;
  const KINDS = ['calendar', 'grades', 'sheet', 'airtable'];
  // storage keys per source: link config + cached raw rows/tabs (so data stays visible offline, SPEC §11)
  // the Airtable config also holds the student's access token — it stays on this device only
  const CFG = { calendar: 'calendar', grades: 'gradesSrc', sheet: 'sheetLink', airtable: 'airtableSrc' };
  const CACHE = { calendar: 'calendarRows', grades: 'gradesRows', sheet: 'tabs', airtable: 'airtableRows' };

  const legacyId = store.get('sheetId', null); // older builds stored only the sheet id
  const state = {
    lang: store.get('lang', (navigator.language || 'en').toLowerCase().startsWith('he') ? 'he' : 'en'),
    src: {
      calendar: store.get(CFG.calendar, null), // { input, link, gid, tabName }
      grades: store.get(CFG.grades, null),
      sheet: store.get(CFG.sheet, null) || (legacyId ? { input: '', link: { kind: 'sheet', id: legacyId, gid: null } } : null),
      airtable: store.get(CFG.airtable, null), // { input, link: { baseId, tableId }, token }
    },
    parsed: { calendar: null, grades: null, sheet: null, airtable: null }, // { data, issues }
    errors: { calendar: false, grades: false, sheet: false, airtable: false },
    lastSync: store.get('lastSync', null),
    sessions: store.get('sessions', []),
    localExams: store.get('localExams', []),
    done: store.get('done', {}),
    missionIds: store.get('mission', {}),
    confidence: store.get('confidence', {}),
    calFilter: store.get('calFilter', { mode: 'auto', selected: [] }), // which calendar subjects are shown
    manualTasks: store.get('manualTasks', []), // { id, date (today), title, subject?, minutes }
    manualGrades: store.get('manualGrades', []), // { id, subject, grade, date, title } — weight is always 1
    manualLessons: store.get('manualLessons', []), // { id, weekday 1-7, start, end, subject, room }
    settings: { dailyCapMin: 180, weeklyGoalMin: 300, weakThreshold: 70, showHebrewDate: true },
    bannerCollapsed: false,
    rev: 0,
    memo: null,
  };
  let t = SP.i18n.makeT(state.lang);
  const now = () => new Date();
  const hasSources = () => KINDS.some((k) => state.src[k]);
  const anyError = () => KINDS.some((k) => state.errors[k]);
  const bump = () => {
    state.rev++;
    state.memo = null;
  };

  // ---------- parsing raw rows into data ----------
  function parseSource(kind, cache) {
    if (kind === 'sheet') {
      const r = SH.normalize(cache);
      return { data: r.data, issues: r.issues };
    }
    if (kind === 'airtable') {
      const r = SH.parseScheduleRows(cache, 'Airtable');
      return { data: { schedule: r.schedule }, issues: r.issues };
    }
    if (kind === 'calendar') {
      const r = SH.parseExamCalendar(cache);
      return { data: { exams: r.exams }, issues: r.issues, missingColumns: r.missingColumns };
    }
    const r = SH.parseGradeRows(cache, 'Grades sheet', { canonical: true });
    return { data: { grades: r.grades }, issues: r.issues, missingColumns: r.missingColumns };
  }

  function loadCaches() {
    for (const k of KINDS) {
      const cache = store.get(CACHE[k], null);
      if (state.src[k] && cache) state.parsed[k] = parseSource(k, cache);
    }
    bump();
  }

  // ---------- merged data ----------
  function data() {
    const key = state.lang + L.ymd(now()) + '#' + state.rev;
    if (state.memo && state.memo.key === key) return state.memo.value;
    let value;
    const p = state.parsed;
    const hasManual = state.manualGrades.length > 0 || state.manualLessons.length > 0;
    if (!p.sheet && !p.calendar && !p.grades && !p.airtable && !hasManual) {
      value = SP.sample.build(now(), state.lang);
      value.isSample = true;
    } else {
      const base = p.sheet ? p.sheet.data : { subjects: [], schedule: [], exams: [], grades: [], holidays: [] };
      const schedule = [...base.schedule, ...(p.airtable ? p.airtable.data.schedule : []), ...manualSchedule()];
      const exams = [...base.exams];
      let calendarInfo = null;
      if (p.calendar) {
        // the school calendar covers every track of the grade: keep only the tests of the student's subjects
        const calAll = p.calendar.data.exams;
        const f = calendarFilter(calAll, schedule.map((l) => l.subject).filter(Boolean));
        const shown = calAll.filter((c) => f.allowed.has(c.subject) && !exams.some((e) => e.subject === c.subject && e.date === c.date));
        exams.push(...shown);
        calendarInfo = {
          total: calAll.length,
          shown: shown.length,
          hasTimetable: f.hasTimetable,
          block: f.block,
          subjects: f.subjects.map((name) => ({ name, count: calAll.filter((c) => c.subject === name).length, shown: f.allowed.has(name) })),
        };
      }
      // hand-entered grades never ask for a weight: every one counts as 1
      const manualGrades = state.manualGrades.map((g) => ({ date: g.date, subject: g.subject, title: g.title || '', grade: g.grade, weight: 1, id: g.id, manual: true }));
      const grades = [...base.grades, ...(p.grades ? p.grades.data.grades : []), ...manualGrades];
      const subjects = base.subjects.map((s) => ({ ...s }));
      // subjects that only appear in exams / grades / lessons get a colour too; names are matched loosely (quotes, niqqud)
      for (const name of [...exams.map((e) => e.subject), ...grades.map((g) => g.subject), ...schedule.map((l) => l.subject).filter(Boolean)]) {
        if (!subjects.some((s) => SH.sameSubject(s.name, name))) subjects.push({ name, color: SH.PALETTE[subjects.length % SH.PALETTE.length], targetAverage: null });
      }
      // make grade subjects use the same spelling as the exam / schedule subject
      for (const g of grades) {
        const s = subjects.find((x) => SH.sameSubject(x.name, g.subject));
        if (s) g.subject = s.name;
      }
      // make lessons use the same subject spelling as the rest, too
      for (const l of schedule) {
        const s = l.subject && subjects.find((x) => SH.sameSubject(x.name, l.subject));
        if (s) l.subject = s.name;
      }
      value = { subjects, schedule, holidays: base.holidays, exams, grades, calendarInfo, isSample: false };
    }
    state.memo = { key, value };
    return value;
  }

  // Which calendar subjects to show: 'auto' = the subjects of my timetable, 'custom' = my own pick, 'all' = everything.
  // With no timetable, 'auto' cannot tell which tracks are mine, so nothing is hidden.
  function calendarFilter(calExams, myLessonSubjects) {
    const f = state.calFilter;
    const subjects = [...new Set(calExams.map((e) => e.subject))];
    const mine = [...new Set(myLessonSubjects)];
    let allowed;
    if (f.mode === 'all') allowed = subjects;
    else if (f.mode === 'custom') allowed = subjects.filter((s) => f.selected.includes(s));
    // block exams ("גוש א׳" / "גוש ב׳") belong to the student's own block, decided by the track in the timetable
    const b = SH.blockOfSubjects(mine);
    const isBlock = (s) => /^גוש /.test(s);
    if (f.mode !== 'all' && f.mode !== 'custom') {
      allowed = mine.length ? subjects.filter((s) => (isBlock(s) ? SH.norm(s).endsWith(' ' + b.block) : mine.some((m) => SH.sameSubject(m, s)))) : subjects;
    }
    return { subjects, allowed: new Set(allowed), hasTimetable: mine.length > 0, block: mine.length ? b : null };
  }

  // hand-entered timetable: one row per weekday; periods are numbered by start time
  function manualSchedule() {
    const byDay = {};
    state.manualLessons.forEach((l) => (byDay[l.weekday] = byDay[l.weekday] || []).push(l));
    const out = [];
    for (const wd of Object.keys(byDay)) {
      byDay[wd]
        .sort((a, b) => L.timeToMin(a.start) - L.timeToMin(b.start))
        // imported files carry their own period numbers; hand-entered lessons are numbered by start time
        .forEach((l, i) => out.push({ ...l, date: null, period: l.period || String(i + 1), teacher: l.teacher || '', type: 'lesson', validFrom: null, validTo: null, manual: true }));
    }
    return out;
  }

  const hydrateLocal = (e) => {
    const startsAt = L.parseYmd(e.date);
    const [h, m] = e.time.split(':').map(Number);
    startsAt.setHours(h, m, 0, 0);
    return { ...e, startsAt, source: 'local' };
  };

  function allExams() {
    const d = data();
    const locals = state.localExams
      .map(hydrateLocal)
      .filter((le) => !d.exams.some((se) => se.subject === le.subject && se.date === le.date)); // sheet wins (SPEC F1)
    return [...d.exams, ...locals];
  }

  const ctx = () => ({ schedule: data().schedule, holidays: data().holidays, settings: state.settings, sessions: state.sessions });
  const subjectOf = (name) => data().subjects.find((s) => s.name === name) || { name, color: '#7c6cff' };
  const color = (name) => subjectOf(name).color || '#7c6cff';

  // ---------- formatting ----------
  const locale = () => (state.lang === 'he' ? 'he-IL' : 'en-GB');
  function fmtDate(d, withYear) {
    const opts = { weekday: 'short', day: 'numeric', month: 'short' };
    if (withYear) opts.year = 'numeric';
    let s = new Intl.DateTimeFormat(locale(), opts).format(d);
    if (state.lang === 'he' && state.settings.showHebrewDate) {
      s += ' · ' + new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long' }).format(d);
    }
    return s;
  }
  const fmtTime = (d) => L.pad(d.getHours()) + ':' + L.pad(d.getMinutes());
  const dur = (m) => SP.i18n.durationText(m, state.lang);
  const when = (exam) => SP.i18n.daysPhrase(L.daysBetween(now(), exam.startsAt), state.lang, t);
  const typeName = (type) => t('types')[type] || type;

  // "Math — Math test" would repeat itself, so show the text alone when it already names the subject
  function label(subject, text) {
    return SH.norm(text).includes(SH.norm(subject))
      ? `<bdi>${esc(text)}</bdi>`
      : `<bdi>${esc(subject)}</bdi> — <bdi>${esc(text)}</bdi>`;
  }

  // "1 grade" / "2 grades" / Hebrew "ציון אחד" / "שני ציונים" / "3 ציונים"
  const countText = (n, key) => (n === 1 ? t(key + 'One') : n === 2 && state.lang === 'he' ? t(key + 'Two') : t(key, { n }));

  function relTime(ms) {
    const mins = Math.floor((Date.now() - ms) / 60000);
    if (mins < 1) return t('justNow');
    if (mins < 60) return mins === 1 ? t('minAgoOne') : t('minAgo', { n: mins });
    return countText(Math.floor(mins / 60), 'hAgo');
  }

  function lessonSlot(exam) {
    const lesson = L.lessonsOn(data().schedule, exam.startsAt, data().holidays).find((l) => l.subject === exam.subject);
    return lesson && lesson.period ? t('period', { n: lesson.period }) : '';
  }

  // ---------- render: top bar ----------
  function renderTop() {
    const g = L.gradeSummary(data().grades, data().subjects, state.settings);
    // with no grades yet the chip still opens the grades dialog, so the first grade can be entered by hand
    const avg = g.overall !== null
      ? `<button class="chip chip-avg" data-action="grades" title="${esc(t('avgTitle'))}" aria-label="${esc(t('avgTitle'))}">${esc(t('avg'))} <strong>${g.overall.toFixed(1)}</strong></button>`
      : `<button class="chip" data-action="grades">${esc(t('grades'))}</button>`;
    let status;
    if (hasSources()) {
      const cls = anyError() ? ' err' : '';
      const text = anyError() ? '⚠ ' + t('syncError') : state.lastSync ? t('updated', { t: relTime(state.lastSync) }) : '';
      status = `<span class="chip chip-status${cls}" role="status">${esc(text)}</span>
        <button class="chip chip-icon" data-action="refresh" aria-label="${esc(t('refresh'))}" title="${esc(t('refresh'))}">⟳</button>`;
    } else {
      status = `<span class="chip chip-status">${esc(data().isSample ? t('sample') : t('manualData'))}</span>`;
    }
    $('#topbar').innerHTML = `
      <div class="logo"><i aria-hidden="true">✦</i>${esc(t('appName'))}</div>
      ${avg}
      ${status}
      <button class="chip" data-action="sources">📄 ${esc(t('sources'))}</button>
      <button class="chip" data-action="lang" lang="${state.lang === 'he' ? 'en' : 'he'}">${esc(t('language'))}</button>`;
  }

  // ---------- render: 7-day banner ----------
  function renderBanner() {
    const exams = allExams();
    const list = L.weekNotice(exams, now());
    if (!list.length) {
      $('#banner').innerHTML = '';
      return;
    }
    const c = ctx();
    const cluster = L.findCluster(exams, c, now());
    const title = list.length === 1 ? t('bannerOne') : t('bannerMany', { n: list.length });
    const items = list
      .map((e) => {
        const r = L.readiness(e, c, now());
        return `<li><span class="dot" style="background:${color(e.subject)}"></span>
          <span>${label(e.subject, e.title)}</span>
          <span class="when">${esc(when(e))} · ${esc(t('freeHours', { t: dur(r.available) }))}</span></li>`;
      })
      .join('');
    const clusterHtml = cluster
      ? `<div class="cluster"><span aria-hidden="true">⚠</span><span>${esc(t('cluster', { n: cluster.count, date: fmtDate(cluster.start) }))}</span></div>`
      : '';
    $('#banner').innerHTML = `
      <div class="banner${state.bannerCollapsed ? ' collapsed' : ''}" role="region" aria-label="${esc(title)}">
        <div class="banner-head"><span class="ico" aria-hidden="true">🔔</span><h2>${esc(title)}</h2>
          <button class="link" data-action="banner">${esc(state.bannerCollapsed ? t('expand') : t('collapse'))}</button></div>
        <ul>${items}</ul>${clusterHtml}
      </div>`;
  }

  // ---------- render: hero ----------
  function renderHero() {
    const el = $('#hero');
    const list = L.upcoming(allExams(), now());
    if (!list.length) {
      el.innerHTML = `<div class="card"><div class="empty"><b>${esc(t('noTests'))}</b>${esc(t('noTestsHint'))}</div></div>`;
      return;
    }
    const e = list[0];
    const cd = L.countdown(e, now());
    const r = L.readiness(e, ctx(), now());
    const slot = lessonSlot(e);
    const hint = r.status === 'boost' ? t('boostHint', { m: r.extraPerDay || 5 }) : r.status === 'tight' ? t('tightHint') : t('okHint');
    const icon = { ontrack: '✓', tight: '◐', boost: '↑' }[r.status];
    const later = list
      .slice(1, 4)
      .map(
        (x) => `<div class="later-chip"><b><span class="dot" style="background:${color(x.subject)}"></span><bdi>${esc(x.subject)}</bdi></b>
          <span>${esc(typeName(x.type))} · ${esc(when(x))}</span><span>${esc(fmtDate(x.startsAt))}</span></div>`
      )
      .join('');
    const meta = [fmtDate(e.startsAt, true), e.noTime ? '' : fmtTime(e.startsAt), slot].filter(Boolean).join(' · ');
    el.innerHTML = `
      <article class="card hero" data-level="${cd.level}">
        <div class="hero-top"><span>${esc(t('nextTest'))}</span>${e.source === 'local' ? `<span class="tag">${esc(t('local'))}</span>` : ''}
          <span style="margin-inline-start:auto" class="tag">${esc(typeName(e.type))}${e.moed === 'B' ? ' · ' + esc(t('moedB')) : ''}</span></div>
        <div class="hero-subject"><span class="dot" style="background:${color(e.subject)};width:14px;height:14px;flex:none"></span><h2>${label(e.subject, e.title)}</h2></div>
        <p class="hero-meta">${esc(meta)}</p>
        <div class="cd" role="timer" aria-label="${esc(cd.days + ' ' + t('days') + ' ' + cd.hours + ' ' + t('hours'))}">
          <div class="cd-box"><div class="cd-num">${cd.days}</div><div class="cd-lbl">${esc(t('days'))}</div></div>
          <div class="cd-box"><div class="cd-num">${L.pad(cd.hours)}</div><div class="cd-lbl">${esc(t('hours'))}</div></div>
          <div class="cd-box"><div class="cd-num">${L.pad(cd.minutes)}</div><div class="cd-lbl">${esc(t('min'))}</div></div>
        </div>
        <span class="badge ${r.status}"><span aria-hidden="true">${icon}</span>${esc(t(r.status))}</span>
        <p class="hint">${esc(hint)}</p>
        <div class="stats">
          <div class="stat"><b>${esc(dur(r.available))}</b><span>${esc(t('timeAvailable'))}</span></div>
          <div class="stat"><b>${esc(dur(r.needed))}</b><span>${esc(t('timeNeeded'))}</span></div>
          <div class="stat"><b>${esc(dur(r.logged))}</b><span>${esc(t('timeLogged'))}</span></div>
        </div>
        <div class="row"><button class="btn btn-primary btn-block" data-action="timer" data-subject="${esc(e.subject)}">${esc(t('startStudying'))}</button>
          ${e.source === 'local' ? `<button class="btn btn-danger" style="flex:0 0 auto" data-action="delLocal" data-id="${esc(e.id)}">${esc(t('delete'))}</button>` : ''}</div>
        ${later ? `<div class="later"><div class="later-title">${esc(t('later'))}</div><div class="later-row">${later}</div></div>` : ''}
      </article>`;
  }

  // ---------- render: today's schedule ----------
  function renderSchedule() {
    const n = now();
    const d = data();
    const lessons = L.lessonsOn(d.schedule, n, d.holidays);
    const todaysTests = allExams().filter((e) => L.sameDay(e.startsAt, n));
    const minNow = n.getHours() * 60 + n.getMinutes();
    let body;
    if (!d.schedule.length) {
      body = `<div class="empty">${esc(t('noSchedule'))}<div style="margin-block-start:10px"><button class="btn" data-action="timetable">${esc(t('addLesson'))}</button></div>${
        todaysTests.length ? '<ul class="lessons" style="margin-block-start:10px">' + todaysTests.map((x) => `<li class="lesson"><span class="bar" style="background:${color(x.subject)}"></span><span class="name">${label(x.subject, x.title)}</span><span class="pill test">${esc(t('testToday'))}</span></li>`).join('') + '</ul>' : ''
      }</div>`;
    } else if (!lessons.length) {
      body = `<div class="empty"><b>${esc(t('noLessons'))}</b>${esc(t('noLessonsFree', { t: dur(L.freeMinutesOn(n, ctx(), n)) }))}</div>`;
    } else {
      const nextIdx = lessons.findIndex((l) => L.timeToMin(l.start) > minNow);
      body =
        '<ul class="lessons">' +
        lessons
          .map((l, i) => {
            const s = L.timeToMin(l.start), en = L.timeToMin(l.end);
            const cur = minNow >= s && minNow < en;
            const past = minNow >= en;
            const test = todaysTests.some((x) => x.subject === l.subject);
            return `<li class="lesson${cur ? ' current' : ''}${past ? ' past' : ''}">
              <span class="bar" style="background:${color(l.subject)}"></span>
              <span class="time">${esc(l.start)}–${esc(l.end)}</span>
              <span class="name"><bdi>${esc(l.subject)}</bdi>${l.period ? ` <span class="room">· ${esc(t('period', { n: l.period }))}</span>` : ''}${l.room ? ` <span class="room">· <bdi>${esc(l.room)}</bdi></span>` : ''}</span>
              ${cur ? `<span class="pill now">${esc(t('now'))}</span>` : i === nextIdx ? `<span class="pill next">${esc(t('next'))}</span>` : ''}
              ${test ? `<span class="pill test">${esc(t('testToday'))}</span>` : ''}
            </li>`;
          })
          .join('') +
        '</ul>';
    }
    $('#schedule').innerHTML = `<div class="card"><div class="card-title"><span>${esc(t('schedule'))} · ${esc(fmtDate(n))}</span>
      <button class="chip" style="min-height:32px;padding:2px 10px;font-size:13px" data-action="timetable">✎ ${esc(t('editTimetable'))}</button></div>${body}</div>`;
  }

  // ---------- render: Today's Mission ----------
  function todayMission() {
    const n = now();
    const key = L.ymd(n);
    const g = L.gradeSummary(data().grades, data().subjects, state.settings);
    const tasks = L.buildTasks(allExams(), ctx(), n, g.rows, state.confidence);
    const map = Object.fromEntries(tasks.map((x) => [x.id, x]));
    let ids = (state.missionIds[key] || []).filter((id) => map[id]);
    if (ids.length < 3) {
      const extra = L.pickMission(tasks.filter((x) => !ids.includes(x.id)), state.settings.dailyCapMin).slice(0, 3 - ids.length);
      ids = ids.concat(extra.map((x) => x.id));
    }
    if (JSON.stringify(ids) !== JSON.stringify(state.missionIds[key] || [])) {
      state.missionIds = { [key]: ids }; // keep only today
      store.set('mission', state.missionIds);
    }
    return ids.map((id) => map[id]);
  }

  function renderMission() {
    const n = now();
    const key = L.ymd(n);
    const missions = todayMission();
    const done = state.done[key] || [];
    const s = L.streak(state.sessions, n);
    const wk = L.weekMinutes(state.sessions, n);
    const pct = Math.min(100, Math.round((wk / state.settings.weeklyGoalMin) * 100));
    // suggested tasks (top 3) first, then the ones the student added for today
    const mine = customTasks();
    const items = [
      ...missions.map((m) => ({ id: m.id, name: label(m.subject, m.topic), sub: `<bdi>${esc(m.examTitle)}</bdi> · ${esc(SP.i18n.daysPhrase(m.daysLeft, state.lang, t))}`, minutes: m.minutes, mine: false })),
      ...mine.map((m) => ({ id: m.id, name: m.subject ? label(m.subject, m.title) : `<bdi>${esc(m.title)}</bdi>`, sub: esc(t('myTask')), minutes: m.minutes, mine: true })),
    ];
    let body;
    if (!items.length) body = `<div class="empty">${esc(t('missionEmpty'))}</div>`;
    else {
      const allDone = items.every((m) => done.includes(m.id));
      body =
        '<ul class="tasks">' +
        items
          .map((m) => {
            const isDone = done.includes(m.id);
            return `<li class="task${isDone ? ' done' : ''}"><input type="checkbox" id="task-${esc(m.id)}" data-action="task" data-id="${esc(m.id)}" ${isDone ? 'checked' : ''}>
              <label for="task-${esc(m.id)}"><span class="t-name">${m.name}</span><span class="t-sub">${m.sub}</span></label>
              <span class="t-min">${esc(dur(m.minutes))}</span>
              ${m.mine ? `<button class="btn btn-danger" style="min-height:32px;padding:0 8px" data-action="delTask" data-id="${esc(m.id)}" aria-label="${esc(t('delete'))}">✕</button>` : ''}</li>`;
          })
          .join('') +
        '</ul>' +
        (allDone ? `<p class="hint" style="color:var(--ok)">🎉 ${esc(t('missionDone'))}</p>` : '');
    }
    $('#mission').innerHTML = `
      <div class="card"><div class="card-title"><span>${esc(t('mission'))}</span>
        <span style="display:flex;gap:6px;align-items:center"><span class="tag">🔥 ${esc(s ? countText(s, 'streak') : t('streakNone'))}</span>
        <button class="chip" style="min-height:32px;padding:2px 10px;font-size:13px" data-action="menuTask" aria-label="${esc(t('addTask'))}" title="${esc(t('addTask'))}">＋</button></span></div>
        ${body}
        <div style="margin-block-start:14px" class="note">${esc(t('goal'))}: ${esc(dur(wk))} / ${esc(dur(state.settings.weeklyGoalMin))}
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div></div>
      </div>`;
  }

  function renderStatic() {
    $('#skip').textContent = t('skip');
    $('#fab').setAttribute('aria-label', t('addTest'));
    $('#fab').title = t('addTest');
  }

  function render() {
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'he' ? 'rtl' : 'ltr';
    renderStatic();
    renderTop();
    renderBanner();
    renderHero();
    renderSchedule();
    renderMission();
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  // ---------- sessions & tasks ----------
  const saveSessions = () => store.set('sessions', state.sessions);
  function addSession(subject, minutes, taskId) {
    state.sessions.push({ id: 's' + Date.now() + Math.random().toString(36).slice(2, 6), date: L.ymd(now()), subject, minutes, taskId: taskId || null });
    saveSessions();
  }

  // tasks the student added for today; tasks from earlier days are dropped
  function customTasks() {
    const key = L.ymd(now());
    if (state.manualTasks.some((x) => x.date !== key)) {
      state.manualTasks = state.manualTasks.filter((x) => x.date === key);
      store.set('manualTasks', state.manualTasks);
    }
    return state.manualTasks;
  }

  function toggleTask(id, checked) {
    const key = L.ymd(now());
    const done = new Set(state.done[key] || []);
    const task = todayMission().find((m) => m.id === id) || customTasks().find((m) => m.id === id);
    if (checked) {
      done.add(id);
      if (task) addSession(task.subject || '', task.minutes, id);
    } else {
      done.delete(id);
      state.sessions = state.sessions.filter((s) => !(s.taskId === id && s.date === key));
      saveSessions();
    }
    state.done = { [key]: [...done] };
    store.set('done', state.done);
    render();
  }

  // ---------- dialogs ----------
  const showDlg = (sel) => {
    const d = $(sel);
    if (!d.open) d.showModal();
  };
  const subjectList = () => `<datalist id="dlSubjects">${data().subjects.map((s) => `<option value="${esc(s.name)}"></option>`).join('')}</datalist>`;
  const parseGradeInput = (s) => {
    const v = parseFloat(String(s).replace(',', '.'));
    return isFinite(v) && v >= 0 && v <= 100 ? v : null;
  };

  // "+" button: choose what to add
  function openMenu() {
    $('#dlgAdd').innerHTML = `<div class="dlg-body"><h2>${esc(t('addWhat'))}</h2>
      <button class="btn btn-block" data-action="menuTest">📝 ${esc(t('addTest'))}</button>
      <button class="btn btn-block" data-action="menuTask">✅ ${esc(t('addTask'))}</button>
      <button class="btn btn-block" data-action="menuGrade">🎯 ${esc(t('addGrade'))}</button>
      <button class="btn btn-block" data-action="menuLesson">📚 ${esc(t('addLesson'))}</button>
      <div class="actions"><button class="btn" data-action="closeDlg">${esc(t('cancel'))}</button></div></div>`;
    showDlg('#dlgAdd');
  }

  // a task for today: what to do, optional subject, minutes
  function openTaskForm() {
    $('#dlgAdd').innerHTML = `<form method="dialog" class="dlg-body" id="formTask">
      <h2>${esc(t('addTask'))}</h2>
      <div class="field"><label for="tTitle">${esc(t('fTaskTitle'))}</label><input id="tTitle" maxlength="80" autocomplete="off" required></div>
      <div class="row"><div class="field"><label for="tSubject">${esc(t('fSubjectOpt'))}</label><input id="tSubject" list="dlSubjects" maxlength="60" autocomplete="off"></div>
        <div class="field"><label for="tMinutes">${esc(t('fMinutes'))}</label><input id="tMinutes" type="number" min="5" max="240" step="5" value="30" required></div></div>${subjectList()}
      <div id="tMsg"></div>
      <div class="actions"><button type="button" class="btn" data-action="closeDlg">${esc(t('cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(t('save'))}</button></div></form>`;
    showDlg('#dlgAdd');
    $('#tTitle').focus();
    $('#formTask').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const title = $('#tTitle').value.trim();
      const minutes = Math.round(Number($('#tMinutes').value));
      const fail = (key) => {
        $('#tMsg').innerHTML = `<div class="err-box">${esc(t(key))}</div>`;
      };
      if (!title) return fail('needTitle');
      if (!isFinite(minutes) || minutes < 5 || minutes > 240) return fail('badMinutes');
      state.manualTasks.push({ id: 'mt' + Date.now(), date: L.ymd(now()), title, subject: $('#tSubject').value.trim(), minutes });
      store.set('manualTasks', state.manualTasks);
      $('#dlgAdd').close();
      render();
      toast(t('taskSaved'));
    });
  }

  // manual grade — subject, grade, date; never asks for a weight (it is always 1)
  function openGradeForm(msg) {
    const today = L.ymd(now());
    $('#dlgAdd').innerHTML = `<form method="dialog" class="dlg-body" id="formGrade">
      <h2>${esc(t('addGrade'))}</h2>
      <div class="field"><label for="gSubject">${esc(t('fSubject'))}</label><input id="gSubject" list="dlSubjects" maxlength="60" autocomplete="off" required></div>${subjectList()}
      <div class="row"><div class="field"><label for="gGrade">${esc(t('fGrade'))}</label><input id="gGrade" inputmode="decimal" autocomplete="off" required></div>
        <div class="field"><label for="gDate">${esc(t('fDate'))}</label><input id="gDate" type="date" value="${today}" max="${today}" required></div></div>
      <div class="field"><label for="gTitle">${esc(t('fTitleOpt'))}</label><input id="gTitle" maxlength="60"></div>
      <div id="gMsg">${msg ? `<div class="err-box">${esc(msg)}</div>` : ''}</div>
      <div class="actions"><button type="button" class="btn" data-action="closeDlg">${esc(t('cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(t('save'))}</button></div></form>`;
    showDlg('#dlgAdd');
    $('#gSubject').focus();
    $('#formGrade').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const subject = $('#gSubject').value.trim();
      const grade = parseGradeInput($('#gGrade').value);
      const date = $('#gDate').value || L.ymd(now());
      const fail = (key) => {
        $('#gMsg').innerHTML = `<div class="err-box">${esc(t(key))}</div>`;
      };
      if (!subject) return fail('needSubject');
      if (grade === null) return fail('badGradeInput');
      state.manualGrades.push({ id: 'mg' + Date.now(), subject, grade, date, title: $('#gTitle').value.trim() });
      store.set('manualGrades', state.manualGrades);
      $('#dlgAdd').close();
      bump();
      render();
      toast(t('gradeSaved'));
    });
  }

  // timetable file (CSV): same columns as the Schedule tab. Re-importing replaces the previously imported lessons.
  async function readTextFile(file) {
    let text = await file.text();
    if (text.includes(String.fromCharCode(0xfffd))) text = new TextDecoder('windows-1255').decode(await file.arrayBuffer()); // Excel "Hebrew" CSV
    return text;
  }

  async function importTimetable(file) {
    let html;
    try {
      const text = await readTextFile(file);
      const rows = SH.parseCSV(text, SH.detectDelimiter(text));
      const r = SH.parseScheduleRows(rows, file.name);
      const lessons = r.schedule.filter((l) => l.type === 'lesson' && l.weekday); // weekly lessons only
      if (!lessons.length) {
        html = `<div class="err-box">${esc(t('noLessonsInFile'))}</div>`;
      } else {
        const stamp = Date.now();
        state.manualLessons = state.manualLessons
          .filter((l) => l.source !== 'file')
          .concat(lessons.map((l, i) => ({ id: 'mf' + stamp + '-' + i, source: 'file', weekday: l.weekday, start: l.start, end: l.end, subject: l.subject, room: l.room || '', teacher: l.teacher || '', period: l.period || '' })));
        store.set('manualLessons', state.manualLessons);
        bump();
        render();
        const issues = r.issues.length
          ? `<div><b>${esc(t('issuesTitle', { n: r.issues.length }))}</b><ul class="issues">${r.issues.slice(0, 30).map((i) => `<li>${esc(t('row'))} ${i.row}: ${esc(t('issue_' + i.key))}</li>`).join('')}</ul></div>`
          : '';
        html = `<div class="ok-box">✓ ${esc(t('imported', { n: lessons.length }))}</div>${issues}`;
        toast(t('imported', { n: lessons.length }));
      }
    } catch (e) {
      html = `<div class="err-box">${esc(t('fileReadError'))}</div>`;
    }
    drafts.importMsg = html;
    openTimetable();
  }

  // manual timetable: add one lesson to one or several weekdays
  function openTimetable(msg) {
    const d = data();
    const weekly = d.schedule.filter((l) => !l.date && l.type !== 'off' && l.weekday);
    const todayWd = L.weekdayOf(now());
    const defaultDay = todayWd <= 6 ? todayWd : 1;
    const days = [1, 2, 3, 4, 5, 6, 7]
      .map((wd) => {
        const list = weekly.filter((l) => l.weekday === wd).sort((a, b) => L.timeToMin(a.start) - L.timeToMin(b.start));
        if (!list.length) return '';
        return `<div><div class="note" style="margin-block:8px 4px"><b>${esc(t('wd')[wd - 1])}</b></div><ul class="lessons">${list
          .map(
            (l) => `<li class="lesson"><span class="bar" style="background:${color(l.subject)}"></span>
              <span class="time">${esc(l.start)}–${esc(l.end)}</span>
              <span class="name"><bdi>${esc(l.subject)}</bdi>${l.room ? ` <span class="room">· <bdi>${esc(l.room)}</bdi></span>` : ''}</span>
              ${l.manual ? `<button class="btn btn-danger" style="min-height:36px;padding:2px 10px" data-action="delLesson" data-id="${esc(l.id)}" aria-label="${esc(t('delete'))}">✕</button>` : `<span class="tag">${esc(t('fromSheet'))}</span>`}</li>`
          )
          .join('')}</ul></div>`;
      })
      .join('');
    $('#dlgTimetable').innerHTML = `<div class="dlg-body"><h2>${esc(t('timetable'))}</h2>
      ${days || `<div class="empty">${esc(t('noLessonsYet'))}<br>${esc(t('addLessonHint'))}</div>`}
      <section class="src" style="margin-block-start:8px">
        <h3>${esc(t('importTimetable'))}</h3>
        <p class="note">${esc(t('importHelp'))}${HOSTED ? '' : ` <a href="template/Schedule.csv" download style="color:var(--accent)">${esc(t('downloadTemplate'))}</a>`}</p>
        <div class="field"><input id="timetableFile" type="file" accept=".csv,text/csv,text/plain" aria-label="${esc(t('importTimetable'))}"></div>
        <div id="importMsg">${drafts.importMsg || ''}</div>
        ${state.manualLessons.some((l) => l.source === 'file') ? `<div class="actions"><button type="button" class="btn btn-danger" data-action="removeImported">${esc(t('removeImported'))}</button></div>` : ''}
      </section>
      <form id="formLesson" class="src" style="margin-block-start:8px">
        <h3>${esc(t('addLesson'))}</h3>
        <div class="field"><label for="lSubject">${esc(t('fSubject'))}</label><input id="lSubject" list="dlSubjects" maxlength="60" autocomplete="off" required></div>${subjectList()}
        <div class="field"><span class="note">${esc(t('fDays'))}</span><div class="daychips">${[1, 2, 3, 4, 5, 6, 7]
          .map((wd) => `<label class="daychip"><input type="checkbox" name="wd" value="${wd}"${wd === defaultDay ? ' checked' : ''}><span>${esc(t('wdShort')[wd - 1])}</span></label>`)
          .join('')}</div></div>
        <div class="row"><div class="field"><label for="lStart">${esc(t('fStart'))}</label><input id="lStart" type="time" value="08:00" required></div>
          <div class="field"><label for="lEnd">${esc(t('fEnd'))}</label><input id="lEnd" type="time" value="08:45" required></div>
          <div class="field"><label for="lRoom">${esc(t('fRoom'))}</label><input id="lRoom" maxlength="20"></div></div>
        <div id="lMsg">${msg ? `<div class="err-box">${esc(msg)}</div>` : ''}</div>
        <div class="actions"><button type="submit" class="btn btn-primary">${esc(t('addLesson'))}</button></div>
      </form>
      <div class="actions"><button class="btn" data-action="closeDlg">${esc(t('close'))}</button></div></div>`;
    showDlg('#dlgTimetable');
    $('#formLesson').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const subject = $('#lSubject').value.trim();
      const start = $('#lStart').value;
      const end = $('#lEnd').value;
      const wds = [...document.querySelectorAll('#formLesson input[name=wd]:checked')].map((x) => +x.value);
      const fail = (key) => {
        $('#lMsg').innerHTML = `<div class="err-box">${esc(t(key))}</div>`;
      };
      if (!subject) return fail('needSubject');
      if (!wds.length) return fail('needDays');
      if (!start || !end || L.timeToMin(end) <= L.timeToMin(start)) return fail('badTimes');
      const room = $('#lRoom').value.trim();
      wds.forEach((wd) => state.manualLessons.push({ id: 'ml' + Date.now() + wd, weekday: wd, start, end, subject, room }));
      store.set('manualLessons', state.manualLessons);
      bump();
      render();
      openTimetable();
      toast(t('lessonsSaved'));
    });
  }

  function openAdd() {
    const d = data();
    const tomorrow = L.ymd(L.addDays(L.startOfDay(now()), 1));
    $('#dlgAdd').innerHTML = `<form method="dialog" class="dlg-body" id="formAdd">
      <h2>${esc(t('addTest'))}</h2>
      <p class="note">${esc(t('addLocal'))}</p>
      <div class="field"><label for="fSubject">${esc(t('fSubject'))}</label>
        <select id="fSubject" required>${d.subjects.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="fTitle">${esc(t('fTitle'))}</label><input id="fTitle" maxlength="60"></div>
      <div class="field"><label for="fType">${esc(t('fType'))}</label>
        <select id="fType">${Object.entries(t('types')).map(([k, v]) => `<option value="${k}"${k === 'test' ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      <div class="row"><div class="field"><label for="fDate">${esc(t('fDate'))}</label><input id="fDate" type="date" value="${tomorrow}" required></div>
        <div class="field"><label for="fTime">${esc(t('fTime'))}</label><input id="fTime" type="time" value="09:00" required></div></div>
      <div class="actions"><button type="button" class="btn" data-action="closeDlg">${esc(t('cancel'))}</button>
        <button type="submit" class="btn btn-primary">${esc(t('save'))}</button></div></form>`;
    showDlg('#dlgAdd');
    $('#formAdd').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const subject = $('#fSubject').value;
      const type = $('#fType').value;
      const e = {
        id: 'local:' + Date.now(), subject, type, title: $('#fTitle').value.trim() || subject,
        date: $('#fDate').value, time: $('#fTime').value || '09:00', weight: 3, difficulty: 3, topics: [], notes: '',
      };
      if (!e.date) return;
      state.localExams.push(e);
      store.set('localExams', state.localExams);
      $('#dlgAdd').close();
      render();
    });
  }

  // focus timer (25 min); SPEC S8
  let timer = null;
  function openTimer(subject) {
    if (timer) clearInterval(timer.id);
    timer = { subject, total: 25 * 60, left: 25 * 60, running: false, id: null };
    $('#dlgTimer').innerHTML = `<div class="dlg-body">
      <h2>${esc(t('focus'))}</h2><p class="muted">${esc(t('focusFor', { s: subject }))}</p>
      <div class="timer-face" id="timerFace" role="timer">25:00</div>
      <div class="actions"><button class="btn" data-action="closeTimer">${esc(t('cancel'))}</button>
        <button class="btn" id="btnPause" data-action="timerToggle">${esc(t('startTimer'))}</button>
        <button class="btn btn-primary" data-action="timerFinish">${esc(t('finish'))}</button></div></div>`;
    $('#dlgTimer').showModal();
  }
  function timerFace() {
    const m = Math.floor(timer.left / 60), s = timer.left % 60;
    $('#timerFace').textContent = L.pad(m) + ':' + L.pad(s);
  }
  function timerToggle() {
    if (!timer) return;
    if (timer.running) {
      clearInterval(timer.id);
      timer.running = false;
      $('#btnPause').textContent = t('resume');
    } else {
      timer.running = true;
      $('#btnPause').textContent = t('pause');
      timer.id = setInterval(() => {
        timer.left = Math.max(0, timer.left - 1);
        timerFace();
        if (timer.left === 0) timerFinish();
      }, 1000);
    }
  }
  function timerFinish() {
    if (!timer) return;
    clearInterval(timer.id);
    const minutes = Math.round((timer.total - timer.left) / 60);
    const subject = timer.subject;
    timer = null;
    $('#dlgTimer').close();
    if (minutes >= 1) {
      addSession(subject, minutes, null);
      toast(t('logged', { m: minutes }));
      render();
    }
  }
  function closeTimer() {
    if (timer) clearInterval(timer.id);
    timer = null;
    $('#dlgTimer').close();
  }

  function openGrades() {
    const g = L.gradeSummary(data().grades, data().subjects, state.settings);
    const trendText = { rising: t('trendRising'), stable: t('trendStable'), falling: t('trendFalling') };
    const manual = [...state.manualGrades].sort((a, b) => b.date.localeCompare(a.date));
    const rows = g.rows
      .map((r) => `<li class="g-row"><span class="bar" style="background:${r.subject.color}"></span>
        <div><div class="g-name"><bdi>${esc(r.subject.name)}</bdi></div>
          <div class="g-sub"><span>${esc(countText(r.count, 'gradeCount'))}</span>
            ${r.trend ? `<span class="trend ${r.trend}">${r.trend === 'rising' ? '↗' : r.trend === 'falling' ? '↘' : '→'} ${esc(trendText[r.trend])}</span>` : ''}
            ${r.weak ? `<span class="tag">${esc(t('attention'))}</span>` : ''}</div></div>
        <div class="g-avg">${r.avg.toFixed(1)}</div></li>`)
      .join('');
    $('#dlgGrades').innerHTML = `<div class="dlg-body"><h2>${esc(t('grades'))}</h2>
      ${g.overall !== null ? `<div class="g-overall"><b>${g.overall.toFixed(1)}</b><span class="muted">${esc(t('overall'))}</span></div>` : ''}
      ${rows ? `<ul class="g-list">${rows}</ul>` : `<div class="empty">${esc(t('noGrades'))}</div>`}
      <p class="note">${esc(t('howCalc'))}</p>
      ${manual.length ? `<div><div class="note"><b>${esc(t('myGrades'))}</b></div><ul class="g-list" style="margin-block-start:6px">${manual
        .map((m) => `<li class="g-row" style="grid-template-columns:1fr auto auto"><div><div class="g-name"><bdi>${esc(m.subject)}</bdi></div>
          <div class="g-sub"><span>${esc(m.date)}</span>${m.title ? `<span><bdi>${esc(m.title)}</bdi></span>` : ''}</div></div>
          <div class="g-avg">${esc(m.grade)}</div>
          <button class="btn btn-danger" style="min-height:36px;padding:2px 10px" data-action="delGrade" data-id="${esc(m.id)}" aria-label="${esc(t('delete'))}">✕</button></li>`)
        .join('')}</ul></div>` : ''}
      <div class="actions"><button class="btn" data-action="closeDlg">${esc(t('close'))}</button>
        <button class="btn btn-primary" data-action="gradeForm">＋ ${esc(t('addGrade'))}</button></div></div>`;
    $('#dlgGrades').showModal();
  }

  // ---------- data sources dialog ----------
  // drafts keep what the student typed while the dialog is re-rendered
  const drafts = { url: { calendar: '', grades: '', sheet: '', airtable: '' }, token: '', gid: {}, tabs: {}, msg: {}, importMsg: '' };

  function sourceSummary(kind) {
    const s = state.src[kind];
    const p = state.parsed[kind];
    if (!s || !p) return '';
    let text;
    if (kind === 'calendar') {
      const n = p.data.exams.length;
      text = t(n === 1 ? 'testsLoadedOne' : 'testsLoaded', { n, tab: s.tabName || '' });
    } else if (kind === 'grades') {
      const n = p.data.grades.length;
      text = t(n === 1 ? 'gradesLoadedOne' : 'gradesLoaded', { n });
    } else if (kind === 'airtable') text = t('airtableLoaded', { n: p.data.schedule.length });
    else text = t('sheetLoaded', { l: p.data.schedule.length, e: p.data.exams.length, g: p.data.grades.length });
    const issues = p.issues.length
      ? `<div><b>${esc(t('issuesTitle', { n: p.issues.length }))}</b><ul class="issues">${p.issues
          .slice(0, 40)
          .map((i) => `<li>${esc(i.tab)}, ${esc(t('row'))} ${i.row}: ${esc(t('issue_' + i.key))}</li>`)
          .join('')}</ul></div>`
      : '';
    return `<div class="ok-box">✓ ${esc(text)}</div>${kind === 'calendar' ? calendarFilterUI() : ''}${issues}`;
  }

  // "Which tests to show": my subjects / my own pick / all
  function calendarFilterUI() {
    const info = data().calendarInfo;
    if (!info) return '';
    const f = state.calFilter;
    const radio = (mode, key) => `<label class="opt"><input type="radio" name="calmode" data-calmode="${mode}"${f.mode === mode ? ' checked' : ''}><span>${esc(t(key))}</span></label>`;
    const hidden = info.subjects.filter((s) => !s.shown).map((s) => s.name);
    const picks =
      f.mode === 'custom'
        ? `<div class="pickgrid">${info.subjects
            .map((s) => `<label class="opt"><input type="checkbox" data-calsubj="${esc(s.name)}"${s.shown ? ' checked' : ''}><span><bdi>${esc(s.name)}</bdi> <span class="muted">(${s.count})</span></span></label>`)
            .join('')}</div>`
        : '';
    return `<div class="filterbox"><b>${esc(t('filterTitle'))}</b>
      ${radio('auto', 'filterAuto')}${radio('custom', 'filterCustom')}${radio('all', 'filterAll')}
      ${f.mode === 'auto' && !info.hasTimetable ? `<p class="note">${esc(t('filterNoTimetable'))}</p>` : ''}
      ${f.mode === 'auto' && info.block ? `<p class="note">${esc(t('filterBlock', { b: info.block.block + '׳', track: info.block.track || '—' }))}</p>` : ''}
      ${picks}
      <p class="note">${esc(t('filterCount', { s: info.shown, t: info.total }))}${hidden.length && f.mode !== 'custom' ? ' · ' + esc(t('filterHidden', { list: hidden.join(', ') })) : ''}</p></div>`;
  }

  function setCalFilter(mode) {
    if (mode === 'custom' && state.calFilter.mode !== 'custom') {
      // start from what is shown now, so switching to "choose" does not empty the list
      const info = data().calendarInfo;
      state.calFilter = { mode, selected: info ? info.subjects.filter((s) => s.shown).map((s) => s.name) : [] };
    } else state.calFilter = { ...state.calFilter, mode };
    store.set('calFilter', state.calFilter);
    bump();
    render();
    openSources();
  }

  function toggleCalSubject(name, checked) {
    const sel = new Set(state.calFilter.selected);
    if (checked) sel.add(name);
    else sel.delete(name);
    state.calFilter = { mode: 'custom', selected: [...sel] };
    store.set('calFilter', state.calFilter);
    bump();
    render();
    openSources();
  }

  function sourceSection(kind) {
    const s = state.src[kind];
    const title = { calendar: 'srcCalendarTitle', grades: 'srcGradesTitle', sheet: 'srcSheetTitle', airtable: 'srcAirtableTitle' }[kind];
    const help = { calendar: 'srcCalendarHelp', grades: 'srcGradesHelp', sheet: 'srcSheetHelp', airtable: 'srcAirtableHelp' }[kind];
    const tabs = drafts.tabs[kind] || [];
    const chosen = drafts.gid[kind] || (s && s.gid) || '';
    const tabPicker = tabs.length
      ? `<div class="field"><label for="tab-${kind}">${esc(t('tab'))}</label><select id="tab-${kind}" data-tab="${kind}">${tabs
          .map((x) => `<option value="${esc(x.gid)}"${String(x.gid) === String(chosen) ? ' selected' : ''}>${esc(x.name)}</option>`)
          .join('')}</select></div>`
      : '';
    const value = drafts.url[kind] !== '' ? drafts.url[kind] : s ? s.input : '';
    return `<section class="src" data-kind="${kind}">
      <h3>${esc(t(title))}</h3>
      <p class="note">${esc(t(help))}</p>
      ${kind === 'sheet' || kind === 'grades' ? `<div class="warn-box">${esc(t('publicWarn'))}</div>` : ''}
      <div class="field"><input data-url="${kind}" dir="ltr" placeholder="${esc(t(kind === 'airtable' ? 'airtableLinkPlaceholder' : 'linkPlaceholder'))}" value="${esc(value)}" aria-label="${esc(t(title))}"></div>
      ${kind === 'airtable' ? `<div class="field"><input data-token type="password" dir="ltr" autocomplete="off" placeholder="${esc(s ? t('airtableTokenSaved') : t('airtableToken'))}" value="${esc(drafts.token)}" aria-label="${esc(t('airtableToken'))}"></div>` : ''}
      ${tabPicker}
      <div id="msg-${kind}">${drafts.msg[kind] ? drafts.msg[kind] : ''}</div>
      ${sourceSummary(kind)}
      <div class="actions">
        ${s ? `<button type="button" class="btn btn-danger" data-action="srcDisconnect" data-kind="${kind}">${esc(t('disconnect'))}</button>` : ''}
        <button type="button" class="btn btn-primary" data-action="srcConnect" data-kind="${kind}">${esc(s ? t('reconnect') : t('connect'))}</button>
      </div></section>`;
  }

  // the personal sheet is no longer offered (the timetable comes from Airtable);
  // it stays listed only while an older sheet is still connected, so it can be disconnected
  const shownInSources = (kind) => kind !== 'sheet' || !!state.src.sheet;

  function openSources() {
    const dlg = $('#dlgSheet');
    dlg.innerHTML = `<div class="dlg-body"><h2>${esc(t('sources'))}</h2>
      ${HOSTED ? `<div class="warn-box">${esc(t('hostedNoSheets'))}</div>` : ''}
      ${KINDS.filter(shownInSources).map(sourceSection).join('')}
      <div class="actions"><button class="btn" data-action="closeDlg">${esc(t('close'))}</button></div></div>`;
    if (!dlg.open) dlg.showModal();
  }
  const setMsg = (kind, html) => {
    drafts.msg[kind] = html;
    openSources();
  };
  const errBox = (text) => `<div class="err-box">${esc(text)}</div>`;

  async function loadTabsFor(kind) {
    if (HOSTED) return;
    const link = SH.parseLink(drafts.url[kind]);
    drafts.tabs[kind] = [];
    if (link && link.kind === 'published' && kind !== 'sheet') {
      try {
        drafts.tabs[kind] = await SH.listPublishedTabs(link.id);
        drafts.gid[kind] = link.gid || (drafts.tabs[kind][0] && drafts.tabs[kind][0].gid) || '';
      } catch (e) { /* the connect step reports problems */ }
    }
    drafts.msg[kind] = '';
    openSources();
  }

  async function connectSource(kind) {
    if (HOSTED) return setMsg(kind, errBox(t('hostedNoSheets')));
    const input = (drafts.url[kind] || (state.src[kind] && state.src[kind].input) || '').trim();
    if (kind === 'airtable') return connectAirtable(input);
    const link = SH.parseLink(input);
    if (!link) return setMsg(kind, errBox(t('badLink')));
    setMsg(kind, `<div class="note">${esc(t('connecting'))}</div>`);
    try {
      let cache, cfg;
      if (kind === 'sheet') {
        const { tabs, missing } = await SH.loadSheet(link);
        if (!Object.keys(tabs).length) return setMsg(kind, errBox(t('noTabsFound')));
        cache = tabs;
        cfg = { input, link };
      } else {
        const chosen = drafts.gid[kind] || link.gid || null;
        const r = await SH.loadSingleTab(link, chosen);
        if (!r.rows) throw new Error('no rows');
        const probe = parseSource(kind, r.rows);
        const count = kind === 'calendar' ? probe.data.exams.length : probe.data.grades.length;
        if (probe.missingColumns || count === 0) return setMsg(kind, errBox(t(kind === 'calendar' ? 'nothingFound' : 'noGradesFound')));
        cache = r.rows;
        cfg = { input, link, gid: r.gid, tabName: r.tabName };
      }
      state.src[kind] = cfg;
      store.set(CFG[kind], cfg);
      store.set(CACHE[kind], cache);
      store.del('sheetId');
      state.parsed[kind] = parseSource(kind, cache);
      state.errors[kind] = false;
      state.lastSync = Date.now();
      store.set('lastSync', state.lastSync);
      drafts.msg[kind] = '';
      bump();
      render();
      openSources();
    } catch (e) {
      setMsg(kind, errBox(t('noAccess')));
    }
  }

  // Airtable timetable: table link + personal access token (scope data.records:read)
  async function connectAirtable(input) {
    const kind = 'airtable';
    const link = SH.parseAirtableLink(input);
    if (!link) return setMsg(kind, errBox(t('badAirtableLink')));
    const token = (drafts.token || (state.src[kind] && state.src[kind].token) || '').trim();
    if (!token) return setMsg(kind, errBox(t('airtableNoToken')));
    setMsg(kind, `<div class="note">${esc(t('connecting'))}</div>`);
    try {
      const rows = await SH.loadAirtable(link, token);
      const probe = parseSource(kind, rows);
      if (!probe.data.schedule.length) return setMsg(kind, errBox(t('airtableEmpty')));
      const cfg = { input, link, token };
      state.src[kind] = cfg;
      store.set(CFG[kind], cfg);
      store.set(CACHE[kind], rows);
      state.parsed[kind] = probe;
      state.errors[kind] = false;
      state.lastSync = Date.now();
      store.set('lastSync', state.lastSync);
      drafts.msg[kind] = '';
      drafts.token = '';
      bump();
      render();
      openSources();
    } catch (e) {
      setMsg(kind, errBox(t('airtableNoAccess')));
    }
  }

  function disconnectSource(kind) {
    state.src[kind] = null;
    state.parsed[kind] = null;
    state.errors[kind] = false;
    [CFG[kind], CACHE[kind]].forEach((k) => store.del(k));
    if (kind === 'sheet') store.del('sheetId');
    drafts.url[kind] = '';
    if (kind === 'airtable') drafts.token = '';
    drafts.tabs[kind] = [];
    drafts.gid[kind] = '';
    drafts.msg[kind] = '';
    if (!hasSources()) {
      state.lastSync = null;
      store.del('lastSync');
    }
    bump();
    render();
    openSources();
  }

  // ---------- sync (SPEC §9.7): each source is refreshed on its own; cached data stays if one fails ----------
  async function syncKind(kind) {
    const s = state.src[kind];
    if (!s) return;
    try {
      let cache;
      if (kind === 'airtable') cache = await SH.loadAirtable(s.link, s.token);
      else if (kind === 'sheet') {
        const { tabs, missing } = await SH.loadSheet(s.link);
        if (!Object.keys(tabs).length) throw new Error('missing');
        cache = tabs;
      } else {
        const r = await SH.loadSingleTab(s.link, s.gid);
        if (!r.rows) throw new Error('no rows');
        cache = r.rows;
      }
      store.set(CACHE[kind], cache);
      state.parsed[kind] = parseSource(kind, cache);
      state.errors[kind] = false;
      state.lastSync = Date.now();
      store.set('lastSync', state.lastSync);
    } catch (e) {
      state.errors[kind] = true; // keep cached data visible (SPEC §11)
    }
  }

  async function sync() {
    if (!hasSources() || HOSTED) return;
    await Promise.all(KINDS.map(syncKind));
    bump();
    render();
  }

  // ---------- events ----------
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'lang') {
      state.lang = state.lang === 'he' ? 'en' : 'he';
      store.set('lang', state.lang);
      t = SP.i18n.makeT(state.lang);
      bump();
      render();
    } else if (a === 'grades') openGrades();
    else if (a === 'sources') openSources();
    else if (a === 'refresh') sync().then(() => toast(anyError() ? t('syncError') : t('updated', { t: t('justNow') })));
    else if (a === 'banner') {
      state.bannerCollapsed = !state.bannerCollapsed;
      renderBanner();
    } else if (a === 'timer') openTimer(el.dataset.subject);
    else if (a === 'timerToggle') timerToggle();
    else if (a === 'timerFinish') timerFinish();
    else if (a === 'closeTimer') closeTimer();
    else if (a === 'closeDlg') el.closest('dialog').close();
    else if (a === 'menuTask') openTaskForm();
    else if (a === 'delTask') {
      const key = L.ymd(now());
      state.manualTasks = state.manualTasks.filter((x) => x.id !== el.dataset.id);
      store.set('manualTasks', state.manualTasks);
      state.sessions = state.sessions.filter((s) => !(s.taskId === el.dataset.id && s.date === key)); // undo its logged time
      saveSessions();
      render();
    } else if (a === 'menuTest') openAdd();
    else if (a === 'menuGrade') openGradeForm();
    else if (a === 'menuLesson' || a === 'timetable') {
      $('#dlgAdd').close();
      openTimetable();
    } else if (a === 'gradeForm') {
      $('#dlgGrades').close();
      openGradeForm();
    } else if (a === 'delGrade') {
      state.manualGrades = state.manualGrades.filter((g) => g.id !== el.dataset.id);
      store.set('manualGrades', state.manualGrades);
      bump();
      render();
      openGrades();
    } else if (a === 'removeImported') {
      state.manualLessons = state.manualLessons.filter((l) => l.source !== 'file');
      store.set('manualLessons', state.manualLessons);
      drafts.importMsg = '';
      bump();
      render();
      openTimetable();
    } else if (a === 'delLesson') {
      state.manualLessons = state.manualLessons.filter((l) => l.id !== el.dataset.id);
      store.set('manualLessons', state.manualLessons);
      bump();
      render();
      openTimetable();
    } else if (a === 'srcConnect') connectSource(el.dataset.kind);
    else if (a === 'srcDisconnect') disconnectSource(el.dataset.kind);
    else if (a === 'delLocal') {
      state.localExams = state.localExams.filter((x) => x.id !== el.dataset.id);
      store.set('localExams', state.localExams);
      render();
    }
  });
  document.addEventListener('change', (ev) => {
    const task = ev.target.closest('[data-action="task"]');
    if (task) return toggleTask(task.dataset.id, task.checked);
    const url = ev.target.closest('[data-url]');
    if (url) {
      drafts.url[url.dataset.url] = url.value.trim();
      return loadTabsFor(url.dataset.url);
    }
    const calmode = ev.target.closest('[data-calmode]');
    if (calmode) return setCalFilter(calmode.dataset.calmode);
    const calsubj = ev.target.closest('[data-calsubj]');
    if (calsubj) return toggleCalSubject(calsubj.dataset.calsubj, calsubj.checked);
    const tab = ev.target.closest('[data-tab]');
    if (tab) drafts.gid[tab.dataset.tab] = tab.value;
    if (ev.target.id === 'timetableFile' && ev.target.files[0]) importTimetable(ev.target.files[0]);
  });
  document.addEventListener('input', (ev) => {
    const url = ev.target.closest('[data-url]');
    if (url) drafts.url[url.dataset.url] = url.value.trim();
    if (ev.target.matches('[data-token]')) drafts.token = ev.target.value.trim();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.target.matches && ev.target.matches('[data-token]') && ev.key === 'Enter') {
      ev.preventDefault();
      return connectSource('airtable');
    }
    const url = ev.target.closest && ev.target.closest('[data-url]');
    if (url && ev.key === 'Enter') {
      ev.preventDefault();
      drafts.url[url.dataset.url] = url.value.trim();
      connectSource(url.dataset.url);
    }
  });
  $('#fab').addEventListener('click', openMenu);
  $('#dlgTimer').addEventListener('close', () => {
    if (timer) {
      clearInterval(timer.id);
      timer = null;
    }
  });

  // ---------- start ----------
  loadCaches();
  render();
  sync();
  setInterval(sync, 15 * 60 * 1000); // SPEC F0: every 15 minutes
  setInterval(render, 30 * 1000); // keep countdowns and "now" fresh

  SP.app = { state, render, data, allExams, todayMission, connectSource, drafts, importTimetable };
})();
