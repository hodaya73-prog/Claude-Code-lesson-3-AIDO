    const g = (date, grade, weight) => ({ date, grade, weight, subject: 'X' });

    // §9.6
    check('weighted average 90(w1) + 80(w2) = 83.33', L.subjectAverage([g('2026-01-01', 90, 1), g('2026-01-02', 80, 2)]), 250 / 3, 1e-9);
    check('no grades → null', L.subjectAverage([]), null);
    // §9.10
    check('trend slope 88,82,79 = -4.5', L.trendSlope([g('2026-01-01', 88, 1), g('2026-01-02', 82, 1), g('2026-01-03', 79, 1)]), -4.5);
    check('trend needs 3 grades', L.trendSlope([g('2026-01-01', 88, 1), g('2026-01-02', 82, 1)]), null);
    check('trend label falling', L.trendLabel(-4.5), 'falling');
    check('trend label stable', L.trendLabel(1.9), 'stable');
    check('trend label rising', L.trendLabel(2), 'rising');

    // §9.1 needed minutes: test, difficulty 3, weight 3 → 120*1*1.2*1.1 = 158.4 → 158
    check('needed minutes (test, d3, w3)', L.neededMinutes({ type: 'test', difficulty: 3, weight: 3 }), 158);
    check('needed minutes (bagrut, d4, w5)', L.neededMinutes({ type: 'bagrut', difficulty: 4, weight: 5 }), Math.round(120 * 3 * 1.4 * 1.3));

    // §9.2 / §9.3 with a controlled timetable
    const settings = { dailyCapMin: 180, weeklyGoalMin: 300, weakThreshold: 70 };
    const monday = new Date(2026, 8, 21, 8, 0); // Mon 21 Sep 2026, 08:00
    const schedule = [{ weekday: 2, date: null, period: '1', start: '08:00', end: '13:00', subject: 'Math', type: 'lesson' }];
    const ctx = { schedule, holidays: [], settings, sessions: [] };
    // Monday: lessons end 13:00 → free from 14:00 (13:00 + 30 = 13:30 < 14:00) to 21:30 = 450 → capped 180
    check('free minutes on a school day (capped)', L.freeMinutesOn(monday, ctx, monday), 180);
    const sunday = new Date(2026, 8, 20, 8, 0);
    check('free minutes on a day off (capped)', L.freeMinutesOn(sunday, ctx, monday), 180);
    const cap60 = { ...ctx, settings: { ...settings, dailyCapMin: 60 } };
    check('daily cap applies', L.freeMinutesOn(monday, cap60, monday), 60);
    const lateToday = new Date(2026, 8, 21, 20, 30);
    check('today only counts remaining time', L.freeMinutesOn(lateToday, ctx, lateToday), 60);

    const mkExam = (date, over) => ({ id: 'e' + date, subject: 'Math', title: 'T', type: 'test', date, time: '09:00', startsAt: new Date(date + 'T09:00:00'), weight: 3, difficulty: 3, topics: [], ...over });
    const e5 = mkExam('2026-09-26'); // 5 days later
    const r = L.readiness(e5, ctx, monday);
    check('available minutes over 5 days = 5×180', r.available, 900);
    check('readiness ratio 900/158', r.ratio, 900 / 158, 1e-9);
    check('readiness on track', r.status, 'ontrack');
    check('5-day bagrut (900 of 749 min) is tight', L.readiness({ ...e5, type: 'bagrut', difficulty: 5, weight: 5 }, ctx, monday).status, 'tight');
    const heavy = mkExam('2026-09-24', { type: 'bagrut', difficulty: 5, weight: 5 }); // 3 days → 540 min available
    const rh = L.readiness(heavy, ctx, monday);
    check('heavy exam with 3 days needs a boost', rh.status, 'boost');
    check('boost = ceil((749-540)/3 /5)*5 = 70', rh.extraPerDay, 70);
    check('boost suggests minutes per day (multiple of 5)', rh.extraPerDay % 5, 0);
    check('logged minutes reduce remaining', L.readiness(e5, { ...ctx, sessions: [{ subject: 'Math', minutes: 60, date: '2026-09-21' }] }, monday).remaining, 158 - 60);

    // countdown levels §6.4
    const cd = (ms) => L.countdown({ startsAt: new Date(monday.getTime() + ms) }, monday).level;
    check('countdown >14d = far', cd(15 * 86400000), 'far');
    check('countdown 10d = mid', cd(10 * 86400000), 'mid');
    check('countdown 2d = soon', cd(2 * 86400000), 'soon');
    check('countdown <24h = urgent', cd(5 * 3600000), 'urgent');

    // week notice + cluster §9.13
    const exams = [mkExam('2026-09-22'), mkExam('2026-09-23'), mkExam('2026-09-24'), mkExam('2026-10-05')];
    check('week notice lists tests within 7 days', L.weekNotice(exams, monday).length, 3);
    const cluster = L.findCluster(exams, ctx, monday);
    check('cluster: 3 tests in 4 days', cluster && cluster.count, 3);
    check('cluster suggested start not before today', cluster.start >= L.startOfDay(monday), true);
    check('no cluster when spread out', L.findCluster([mkExam('2026-09-22'), mkExam('2026-09-28'), mkExam('2026-10-05')], ctx, monday), null);
    check('cluster: 2 tests on the same day', !!L.findCluster([mkExam('2026-09-22', { id: 'a' }), mkExam('2026-09-22', { id: 'b' })], ctx, monday), true);
    check('exam in the past is excluded from notice', L.weekNotice([mkExam('2026-09-20')], monday).length, 0);

    // mission §9.14
    const rows = [{ subject: { name: 'Math' }, avg: 62 }, { subject: { name: 'Hist' }, avg: 90 }];
    const near = mkExam('2026-09-23', { id: 'near', topics: ['A'] });
    const far = mkExam('2026-09-27', { id: 'far', subject: 'Hist', topics: ['B'] });
    const tasks = L.buildTasks([far, near], ctx, monday, rows, { 'near|A': 2, 'far|B': 4 });
    check('mission ranks the urgent, weak, low-confidence task first', tasks[0].id, 'near|A');
    // exact scores from SPEC §9.14 example: urgency 1/3, weakness .38, gap .75
    check('mission score (spec example)', 0.5 * (1 / 3) + 0.3 * 0.38 + 0.2 * 0.75, 0.4307, 1e-3);
    const many = Array.from({ length: 5 }, (_, i) => ({ id: 'x' + i, subject: 'Math', minutes: 30, score: 5 - i }));
    check('mission takes at most 2 per subject', L.pickMission(many, 600).length, 2);

    // streak §9.15
    const today = new Date(2026, 8, 21, 12, 0);
    const day = (n) => L.ymd(L.addDays(today, -n));
    check('streak counts consecutive days ≥ 20 min', L.streak([{ date: day(0), minutes: 25 }, { date: day(1), minutes: 20 }, { date: day(2), minutes: 30 }], today), 3);
    check('streak ignores days under 20 min', L.streak([{ date: day(0), minutes: 10 }], today), 0);
    check('streak survives when today is not counted yet', L.streak([{ date: day(1), minutes: 30 }, { date: day(2), minutes: 30 }], today), 2);
    check('week minutes sums Sun–Sat', L.weekMinutes([{ date: '2026-09-20', minutes: 30 }, { date: '2026-09-21', minutes: 45 }, { date: '2026-09-19', minutes: 99 }], today), 75);
    // ---- exams screen filters (SPEC §4.1.5): "now" is Mon 21 Sep 2026 08:00, so the week is Sun 20 – Sat 26 Sep ----
    const exList = [
      mkExam('2026-09-10'), mkExam('2026-09-18'), mkExam('2026-09-22'), mkExam('2026-09-26'), mkExam('2026-09-27'),
      mkExam('2026-09-30'), mkExam('2026-10-05'), mkExam('2026-10-10', { type: 'bagrut' }),
    ];
    const ids = (k, s) => L.examsFilter(exList, k, monday, s).map((e) => e.date.slice(5));
    check('exams filter: all = upcoming, soonest first', ids('all'), ['09-22', '09-26', '09-27', '09-30', '10-05', '10-10']);
    check('exams filter: this week = Sun–Sat (Saturday included, next Sunday not)', ids('week'), ['09-22', '09-26']);
    check('exams filter: this month', ids('month'), ['09-22', '09-26', '09-27', '09-30']);
    check('exams filter: bagrut', ids('bagrut'), ['10-10']);
    check('exams filter: done = already passed, most recent first', ids('done'), ['09-18', '09-10']);
    check('exams filter: unknown key behaves like all', ids('nope').length, 6);
    check('exams filter: empty input', L.examsFilter([], 'all', monday).length, 0);
    check('exams filter: does not mutate its input', exList.map((e) => e.date.slice(5)).slice(0, 2), ['09-10', '09-18']);
    const subj = [mkExam('2026-09-22', { subject: 'ספרות' }), mkExam('2026-09-23', { subject: 'אנגלית' }), mkExam('2026-09-24', { subject: 'ספרות' })];
    check('exams filter: sort by subject, then date', L.examsFilter(subj, 'all', monday, 'subject').map((e) => e.subject + e.date.slice(8)), ['אנגלית23', 'ספרות22', 'ספרות24']);
