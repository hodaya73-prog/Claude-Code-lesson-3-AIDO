/* Pure logic for the dashboard (SPEC §9). No DOM access, so it can be tested in tests.html. */
(function () {
  const SP = (window.SP = window.SP || {});
  const DAY = 86400000;

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);
  const sameDay = (a, b) => ymd(a) === ymd(b);
  const timeToMin = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const weekdayOf = (d) => d.getDay() + 1; // 1 = Sunday … 7 = Saturday (SPEC §8.1)

  // ---------- schedule (SPEC F0.1, §9.2) ----------
  function isHoliday(date, holidays) {
    const key = ymd(date);
    return (holidays || []).some((h) => h.date === key && h.type === 'off');
  }

  function entriesOn(schedule, date) {
    const key = ymd(date);
    const wd = weekdayOf(date);
    const inRange = (e) => (!e.validFrom || e.validFrom <= key) && (!e.validTo || e.validTo >= key);
    const overrides = schedule.filter((e) => e.date === key);
    if (overrides.length) return overrides;
    return schedule.filter((e) => !e.date && e.weekday === wd && inRange(e));
  }

  function lessonsOn(schedule, date, holidays) {
    if (isHoliday(date, holidays)) return [];
    return entriesOn(schedule, date)
      .filter((e) => e.type !== 'off')
      .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  }

  const FREE_END = 21 * 60 + 30;

  function freeMinutesOn(date, ctx, now) {
    const lessons = lessonsOn(ctx.schedule, date, ctx.holidays);
    let start = lessons.length
      ? Math.max(14 * 60, Math.max(...lessons.map((l) => timeToMin(l.end))) + 30)
      : 9 * 60;
    if (sameDay(date, now)) start = Math.max(start, now.getHours() * 60 + now.getMinutes());
    return Math.min(Math.max(0, FREE_END - start), ctx.settings.dailyCapMin);
  }

  // ---------- exams (SPEC §9.1, §9.3) ----------
  const TYPE_FACTOR = { quiz: 0.5, test: 1, exam: 1.5, project: 1, bagrut: 3 };

  function neededMinutes(exam) {
    const base = 120;
    const difficulty = exam.difficulty || 3;
    const weight = exam.weight || 3;
    return Math.round(base * (TYPE_FACTOR[exam.type] || 1) * (0.6 + 0.2 * difficulty) * (0.8 + 0.1 * weight));
  }

  function availableMinutes(exam, ctx, now) {
    let total = 0;
    const last = startOfDay(exam.startsAt);
    for (let d = startOfDay(now); d < last; d = addDays(d, 1)) total += freeMinutesOn(d, ctx, now);
    return total;
  }

  function loggedMinutes(exam, sessions) {
    return sessions.filter((s) => s.subject === exam.subject).reduce((sum, s) => sum + s.minutes, 0);
  }

  function readiness(exam, ctx, now) {
    const needed = neededMinutes(exam);
    const logged = loggedMinutes(exam, ctx.sessions);
    const available = availableMinutes(exam, ctx, now);
    const remaining = Math.max(0, needed - logged);
    const ratio = remaining === 0 ? Infinity : available / remaining;
    const status = ratio >= 1.25 ? 'ontrack' : ratio >= 0.9 ? 'tight' : 'boost';
    const daysLeft = Math.max(1, daysBetween(now, exam.startsAt));
    const extraPerDay = remaining > available ? Math.ceil((remaining - available) / daysLeft / 5) * 5 : 0;
    return { needed, logged, available, remaining, ratio, status, extraPerDay };
  }

  function countdown(exam, now) {
    const ms = exam.startsAt - now;
    if (ms <= 0) return { past: true, ms, days: 0, hours: 0, minutes: 0, level: 'urgent' };
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    // SPEC §6.4 urgency colouring
    const level = ms < DAY ? 'urgent' : ms < 4 * DAY ? 'soon' : ms <= 14 * DAY ? 'mid' : 'far';
    return { past: false, ms, days, hours, minutes, level };
  }

  const upcoming = (exams, now) =>
    exams.filter((e) => e.startsAt > now).sort((a, b) => a.startsAt - b.startsAt);

  // Tests that entered their 7-day window (SPEC F4, banner in §4)
  function weekNotice(exams, now) {
    return upcoming(exams, now).filter((e) => daysBetween(now, e.startsAt) <= 7);
  }

  // Exams screen filters (SPEC §4.1.5). Every filter except "done" lists upcoming tests, soonest first;
  // "week" is the current Sunday–Saturday week, "month" the current calendar month, "done" the tests that already
  // passed, most recent first. Sort 'subject' orders by subject name, then date.
  function examsFilter(exams, key, now, sort) {
    const byDate = [...exams].sort((a, b) => a.startsAt - b.startsAt);
    let list;
    if (key === 'done') list = byDate.filter((e) => e.startsAt <= now).reverse();
    else {
      list = byDate.filter((e) => e.startsAt > now);
      if (key === 'week') {
        const end = addDays(addDays(startOfDay(now), -now.getDay()), 7);
        list = list.filter((e) => e.startsAt < end);
      } else if (key === 'month') {
        list = list.filter((e) => e.startsAt.getFullYear() === now.getFullYear() && e.startsAt.getMonth() === now.getMonth());
      } else if (key === 'bagrut') list = list.filter((e) => e.type === 'bagrut');
    }
    if (sort === 'subject') list = [...list].sort((a, b) => a.subject.localeCompare(b.subject, 'he') || a.startsAt - b.startsAt);
    return list;
  }

  // SPEC §9.13: ≥3 tests within 4 consecutive days, or ≥2 on the same day
  function findCluster(exams, ctx, now) {
    const list = upcoming(exams, now);
    for (let i = 0; i < list.length; i++) {
      const first = startOfDay(list[i].startsAt);
      const group = list.filter((e) => {
        const off = daysBetween(first, e.startsAt);
        return off >= 0 && off <= 3;
      });
      const sameDayCount = group.filter((e) => sameDay(e.startsAt, list[i].startsAt)).length;
      if (group.length >= 3 || sameDayCount >= 2) {
        const sumNeeded = group.reduce((s, e) => s + neededMinutes(e), 0);
        let free = 0;
        for (let k = 0; k < 7; k++) free += freeMinutesOn(addDays(startOfDay(now), k), ctx, now);
        const avgDaily = Math.max(30, free / 7);
        const lead = Math.ceil(sumNeeded / avgDaily);
        let start = addDays(first, -lead);
        if (start < startOfDay(now)) start = startOfDay(now);
        return { count: group.length, first, start, exams: group };
      }
    }
    return null;
  }

  // ---------- grades (SPEC §9.6, §9.9, §9.10) ----------
  function subjectAverage(grades) {
    if (!grades.length) return null;
    const w = grades.reduce((s, g) => s + g.weight, 0);
    return grades.reduce((s, g) => s + g.grade * g.weight, 0) / w;
  }

  function trendSlope(grades) {
    const last = [...grades].sort((a, b) => a.date.localeCompare(b.date)).slice(-5);
    if (last.length < 3) return null;
    const xs = last.map((_, i) => i + 1);
    const xm = xs.reduce((a, b) => a + b, 0) / xs.length;
    const ym = last.reduce((s, g) => s + g.grade, 0) / last.length;
    const num = xs.reduce((s, x, i) => s + (x - xm) * (last[i].grade - ym), 0);
    const den = xs.reduce((s, x) => s + (x - xm) ** 2, 0);
    return num / den;
  }

  const trendLabel = (slope) => (slope === null ? null : slope >= 2 ? 'rising' : slope <= -2 ? 'falling' : 'stable');

  function gradeSummary(grades, subjects, settings) {
    const rows = subjects
      .map((s) => {
        const list = grades.filter((g) => g.subject === s.name);
        const avg = subjectAverage(list);
        const slope = trendSlope(list);
        const trend = trendLabel(slope);
        const target = s.targetAverage;
        const weak =
          avg !== null &&
          (avg < settings.weakThreshold || trend === 'falling' || (target && avg < target - 5));
        return { subject: s, count: list.length, avg, slope, trend, weak };
      })
      .filter((r) => r.count > 0);
    const avgs = rows.map((r) => r.avg);
    const overall = avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
    return { rows, overall };
  }

  // ---------- Today's Mission (SPEC §9.14) ----------
  function buildTasks(exams, ctx, now, gradeRows, confidence) {
    const tasks = [];
    for (const e of upcoming(exams, now)) {
      const daysLeft = daysBetween(now, e.startsAt);
      if (daysLeft > 21) continue;
      const topics = e.topics.length ? e.topics : [e.title];
      const r = readiness(e, ctx, now);
      const total = Math.max(30, r.remaining);
      const per = Math.min(60, Math.max(20, Math.round(total / topics.length / 5) * 5));
      const row = gradeRows.find((g) => g.subject.name === e.subject);
      const weakness = row && row.avg !== null ? (100 - row.avg) / 100 : 0.5;
      for (const t of topics) {
        const id = e.id + '|' + t;
        const conf = confidence[id];
        const gap = conf ? (5 - conf) / 4 : 0.5;
        const urgency = 1 / (daysLeft + 1);
        tasks.push({
          id,
          examId: e.id,
          subject: e.subject,
          topic: t,
          examTitle: e.title,
          minutes: per,
          daysLeft,
          score: 0.5 * urgency + 0.3 * weakness + 0.2 * gap,
        });
      }
    }
    return tasks.sort((a, b) => b.score - a.score);
  }

  function pickMission(tasks, capMin) {
    const picked = [];
    const perSubject = {};
    let total = 0;
    for (const t of tasks) {
      if (picked.length === 3) break;
      if ((perSubject[t.subject] || 0) >= 2) continue;
      if (total + t.minutes > capMin && picked.length > 0) continue;
      picked.push(t);
      perSubject[t.subject] = (perSubject[t.subject] || 0) + 1;
      total += t.minutes;
    }
    return picked;
  }

  // ---------- streak & weekly goal (SPEC §9.15) ----------
  function countedDays(sessions) {
    const byDay = {};
    for (const s of sessions) byDay[s.date] = (byDay[s.date] || 0) + s.minutes;
    return new Set(Object.keys(byDay).filter((k) => byDay[k] >= 20));
  }

  function streak(sessions, now) {
    const days = countedDays(sessions);
    let d = startOfDay(now);
    if (!days.has(ymd(d))) d = addDays(d, -1); // today may not be counted yet
    let n = 0;
    while (days.has(ymd(d))) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  }

  function weekMinutes(sessions, now) {
    const start = addDays(startOfDay(now), -now.getDay()); // Sunday
    const from = ymd(start);
    const to = ymd(addDays(start, 6));
    return sessions.filter((s) => s.date >= from && s.date <= to).reduce((sum, s) => sum + s.minutes, 0);
  }

  Object.assign(SP, {
    logic: {
      DAY, pad, ymd, parseYmd, startOfDay, addDays, daysBetween, sameDay, timeToMin, weekdayOf,
      lessonsOn, entriesOn, isHoliday, freeMinutesOn,
      neededMinutes, availableMinutes, loggedMinutes, readiness, countdown, upcoming,
      weekNotice, findCluster, examsFilter,
      subjectAverage, trendSlope, trendLabel, gradeSummary,
      buildTasks, pickMission, streak, weekMinutes,
    },
  });
})();
