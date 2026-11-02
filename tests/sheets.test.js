    // sheets parsing
    check('csv quotes and commas', S.parseCSV('a,b\n"x,1","he said ""hi"""\n'), [['a', 'b'], ['x,1', 'he said "hi"']]);
    check('date ISO', S.parseDate('2026-09-28'), '2026-09-28');
    check('date Israeli D/M/Y', S.parseDate('28/09/2026'), '2026-09-28');
    check('date D.M.Y', S.parseDate('3.10.2026'), '2026-10-03');
    check('date invalid (31 Feb)', S.parseDate('2026-02-31'), null);
    check('time parse', S.parseTime('9:05'), '09:05');
    check('weekday number', S.parseWeekday('1'), 1);
    check('weekday English', S.parseWeekday('Sun'), 1);
    check('weekday Hebrew', S.parseWeekday('יום ג׳'), 3);
    check('weekday Hebrew word', S.parseWeekday('חמישי'), 5);

    const tabs = {
      Schedule: S.parseCSV('weekday,period,start,end,subject,room\n1,1,08:00,08:45,Math,204\nfunday,1,08:00,08:45,Math,204\n2,1,xx,08:45,Math,1'),
      Exams: S.parseCSV('date,time,subject,title,type,weight,difficulty,topics\n2026-09-28,09:00,Math,Test,test,4,4,"A, B"\nnot-a-date,09:00,Math,X,test,3,3,\n2026-09-29,09:00,,Y,test,3,3,\n2026-09-30,09:00,Math,Z,סוג-לא-נכון,3,3,'),
      Grades: S.parseCSV('date,subject,title,grade,weight\n2026-09-01,Math,Q,90,\n2026-09-02,Math,T,120,1\n2026-09-03,Math,T,80,0\n2026-09-04,Math,T,85,2'),
    };
    const res = S.normalize(tabs);
    check('schedule: 1 valid row', res.data.schedule.length, 1);
    check('schedule issues reported', res.issues.filter((i) => i.tab === 'Schedule').map((i) => i.row + i.key), ['3badWeekday', '4badTime']);
    check('exams: 1 valid row', res.data.exams.length, 1);
    check('exam topics split', res.data.exams[0].topics, ['A', 'B']);
    check('exam issues reported', res.issues.filter((i) => i.tab === 'Exams').map((i) => i.key), ['badDate', 'noSubject', 'badType']);
    check('grades: 2 valid rows', res.data.grades.length, 2);
    check('empty weight defaults to 1', res.data.grades[0].weight, 1);
    check('grade issues reported', res.issues.filter((i) => i.tab === 'Grades').map((i) => i.key), ['badGrade', 'badWeight']);
    check('subjects created from other tabs', res.data.subjects.map((s) => s.name), ['Math']);
    check('Hebrew headers + type work', S.normalize({ Exams: S.parseCSV('תאריך,מקצוע,סוג\n2026-10-01,מתמטיקה,מבחן') }).data.exams[0].type, 'test');
    check('extractId from URL', S.extractId('https://docs.google.com/spreadsheets/d/1AbC_defGHI-jklMNOPqrs123/edit#gid=0'), '1AbC_defGHI-jklMNOPqrs123');
    check('extractId rejects junk', S.extractId('hello'), null);

    // ---- links ----
    const pub = S.parseLink('https://docs.google.com/spreadsheets/d/e/2PACX-1vSabc_DEF-123/pubhtml?gid=1339605019&single=true');
    check('published link: kind, id and gid', [pub.kind, pub.id, pub.gid], ['published', '2PACX-1vSabc_DEF-123', '1339605019']);
    const reg = S.parseLink('https://docs.google.com/spreadsheets/d/1AbC_defGHI-jklMNOPqrs123/edit?gid=42#gid=42');
    check('regular link: kind, id and gid', [reg.kind, reg.id, reg.gid], ['sheet', '1AbC_defGHI-jklMNOPqrs123', '42']);
    check('published id is not mistaken for the letter e', S.parseLink('https://docs.google.com/spreadsheets/d/e/2PACX-1vSx/pubhtml').id, '2PACX-1vSx');
    check('junk link rejected', S.parseLink('hello'), null);
    check('Airtable table link: base and table', S.parseAirtableLink('https://airtable.com/appmsE2WLIFOSvh82/tbl16HAawVOQMPjGC/viwIQYiyrHNk45yfY?blocks=hide'), { baseId: 'appmsE2WLIFOSvh82', tableId: 'tbl16HAawVOQMPjGC' });
    check('Airtable link without a table rejected', S.parseAirtableLink('https://airtable.com/appmsE2WLIFOSvh82'), null);

    // ---- school exam calendar (excerpt of the real published layout: title rows, section row, blank row) ----
    const calCsv = [
      '"לוח מבחנים תשפ""ז — שכבת י""א",,',
      'מוצגים רק מבחנים מהיום והלאה — מתעדכן אוטומטית בכל פתיחה,,',
      ',,',
      'יום,תאריך,מבחן',
      'מחצית א,,',
      'יום חמישי,15/10/26,"י""א - מבחן ספרות"',
      'יום רביעי,21/10/26,יא - מבחן אנגלית',
      ',,',
      'יום שני,09/11/26,"י""א - מבחן מתמטיקה 1"',
      'יום חמישי,12/11/26,יא - בוחן לשון ',
      "יום שני,16/11/26,יא - מבחן גוש ב' 1",
      'יום חמישי,31/12/26,"י""א - מתכונת ספרות"',
      'יום שלישי,05/01/27,"י""א - מבחן אנגלית מועד נוסף"',
      "יום שני,05/07/27,\"י\"\"א - בגרות - מועד ב'  עברית\"",
      'יום רביעי,23/12/26,יוד - מבחן אנגלית 2',
    ].join('\n');
    const cal = S.parseExamCalendar(S.parseCSV(calCsv));
    check('calendar: title/section/blank rows skipped → 9 exams', cal.exams.length, 9);
    check('calendar: sorted by date', cal.exams.map((e) => e.date).slice(0, 4), ['2026-10-15', '2026-10-21', '2026-11-09', '2026-11-12']);
    check('calendar: grade prefix removed from title', cal.exams[0].title, 'מבחן ספרות');
    check('calendar: subject found in text', cal.exams[0].subject, 'ספרות');
    check('calendar: "יא - " prefix removed too', cal.exams[1].title, 'מבחן אנגלית');
    check('calendar: quiz type', cal.exams.find((e) => e.title.includes('בוחן')).type, 'quiz');
    check('calendar: block subject with geresh', cal.exams.find((e) => e.title.includes('גוש')).subject, 'גוש ב׳');
    check('calendar: mock exam type', cal.exams.find((e) => e.title.includes('מתכונת')).type, 'exam');
    const bag = cal.exams.find((e) => e.title.includes('בגרות'));
    check('calendar: bagrut moed B', [bag.type, bag.moed, bag.subject], ['bagrut', 'B', 'עברית']);
    check('calendar: no time of day given', cal.exams[0].noTime, true);
    check('calendar: stable ids', cal.exams[0].id.startsWith('cal:2026-10-15:'), true);
    check('calendar: wrong columns are reported', S.parseExamCalendar(S.parseCSV('a,b\n1,2')).missingColumns, true);

    // ---- grades-only sheet ----
    const grCsv = ['ציוני תלמיד,,,', 'מקצוע,ציון,תאריך,משקל', 'מתמטיקה,88,2026-09-01,', 'מתמטיקה,"82,5",2026-09-10,2', 'אנגלית,,,', '"ספרות 5 יח""ל",90,,', ',,,', 'פיזיקה,abc,,'].join('\n');
    const gr = S.parseGradeRows(S.parseCSV(grCsv), 'Grades sheet', { canonical: true });
    check('grades-only: 3 valid grades', gr.grades.length, 3);
    check('grades-only: decimal comma read', gr.grades[1].grade, 82.5);
    check('grades-only: weight from column', gr.grades[1].weight, 2);
    check('grades-only: date is optional', gr.grades[2].date, '');
    check('grades-only: subject with extra words mapped to the canonical name', gr.grades[2].subject, 'ספרות');
    check('grades-only: empty grade skipped, bad grade reported with the real row number', gr.issues.map((i) => i.row + i.key), ['8badGrade']);
    check('grades-only: needs subject+grade columns', S.parseGradeRows(S.parseCSV('x,y\n1,2'), 'G', {}).missingColumns, true);
    check('subject: specialty track (חנ"ג)', S.canonicalSubject('מתכונת 1 חנ"ג מגמה'), 'חנ״ג');
    check('subject: software engineering', S.canonicalSubject('בגרות מדמ"ח/הנדסת תוכנה 371'), 'הנדסת תוכנה');
    check('subject: spelling variant of psychology', S.canonicalSubject("פסיכולגיה מועד ב'"), 'פסיכולוגיה');
    check('subjects match loosely (quotes / niqqud)', S.sameSubject('תנ"ך', 'תנ״ך'), true);
    check('different subjects do not match', S.sameSubject('מתמטיקה', 'אנגלית'), false);
    check('blank rows keep row numbers (personal sheet)', S.normalize({ Exams: S.parseCSV('date,subject\n\n2026-10-01,Math\nbad,Math') }).issues.map((i) => i.row), [4]);

    // ---- timetable file import ----
    // ---- exam blocks: ב׳ = software engineering / biomedicine / biotechnology / computer science, everything else א׳ ----
    check('block: software engineering → ב', S.blockOfSubjects(['מתמטיקה', 'הנדסת תוכנה']).block, 'ב');
    check('block: software engineering track reported', S.blockOfSubjects(['הנדסת תוכנה']).track, 'הנדסת תוכנה');
    check('block: biomedicine → ב', S.blockOfSubjects(['ביו-רפואה']).block, 'ב');
    check('block: biotechnology → ב', S.blockOfSubjects(['ביוטכנולוגיה']).block, 'ב');
    check('block: computer science → ב', S.blockOfSubjects(['מדעי המחשב']).block, 'ב');
    check('block: any other track → א', S.blockOfSubjects(['מתמטיקה', 'פיזיקה', 'חנ״ג']).block, 'א');
    check('block: biology is not biotechnology', S.blockOfSubjects(['ביולוגיה']).block, 'א');
    check('subject names: biotechnology recognised', S.canonicalSubject('בגרות ביוטכנולוגיה'), 'ביוטכנולוגיה');
    // ---- Google-formatted times and tab detection ----
    check('time: 24h with seconds', S.parseTime('8:45:00'), '08:45');
    check('time: 1:00:00 PM = 13:00', S.parseTime('1:00:00 PM'), '13:00');
    check('time: 12:15 PM stays 12:15', S.parseTime('12:15:00 PM'), '12:15');
    check('time: 12:00 AM = 00:00', S.parseTime('12:00:00 AM'), '00:00');
    check('time: 9:05 am', S.parseTime('9:05 am'), '09:05');
    check('time: 13:00 PM rejected', S.parseTime('13:00 PM'), null);
    check('time: garbage rejected', S.parseTime('soon'), null);
    check('csv: BOM is stripped', S.parseCSV('﻿weekday,start\n1,08:00')[0][0], 'weekday');
    check('csv: semicolon delimiter detected', S.detectDelimiter('weekday;start;end\n1;08:00;08:45'), ';');
    check('csv: comma is the default', S.detectDelimiter('weekday,start,end'), ',');
    check('csv: tab delimiter detected', S.detectDelimiter('weekday\tstart\tend'), '\t');
    check('csv: semicolon file parses', S.parseCSV('a;b\n1;2', ';'), [['a', 'b'], ['1', '2']]);
    const tt = S.parseScheduleRows(S.parseCSV('weekday,period,start,end,subject,room,teacher,type\n1,1,08:45,09:30,פיזיקה,611 ביוטכנולוגיה,מורה לדוגמה,lesson\n2,1,10:00,09:00,מתמטיקה,1,x,lesson\n3,1,08:00,08:45,,1,x,lesson\n9,1,08:00,08:45,אנגלית,1,x,lesson'), 'f.csv');
    check('timetable: 1 valid lesson', tt.schedule.length, 1);
    check('timetable: fields read', [tt.schedule[0].weekday, tt.schedule[0].period, tt.schedule[0].start, tt.schedule[0].end, tt.schedule[0].room, tt.schedule[0].teacher], [1, '1', '08:45', '09:30', '611 ביוטכנולוגיה', 'מורה לדוגמה']);
    check('timetable: end before start / no subject / bad weekday reported', tt.issues.map((i) => i.row + i.key), ['3badTime', '4noSubject', '5badWeekday']);
    check('timetable: Hebrew weekday headers work', S.parseScheduleRows(S.parseCSV('יום,התחלה,סיום,מקצוע\nא,08:00,08:45,מתמטיקה'), 'f').schedule.length, 1);

    // ---- calendar text: second sittings and unknown subjects (found by evals/, kept here as fast regression tests) ----
    {
      const one = (text) => S.parseExamCalendar([['יום', 'תאריך', 'מבחן'], ['יום א׳', '05/01/27', text]]).exams[0];
      check('calendar: "מועד ב\'" marks a second sitting on a plain test', one(`י"א - מבחן לשון מועד ב'`).moed, 'B');
      check('calendar: "מועד נוסף" marks a second sitting too', one('י"א - מבחן מתמטיקה מועד נוסף').moed, 'B');
      check('calendar: a first-sitting test has no sitting', one('י"א - מבחן לשון').moed, null);
      check('calendar: a bagrut without a stated sitting is the first one (A)', one('י"ב - בגרות פיזיקה').moed, 'A');
      check('calendar: second sitting also works for mock exams and quizzes', [one(`י"ב - מתכונת אנגלית מועד ב'`).moed, one(`יא - בוחן לשון מועד ב'`).moed], ['B', 'B']);
      check('subject: philosophy is in the vocabulary (a comment once swallowed it)', one('י"א - בגרות פילוסופיה').subject, 'פילוסופיה');
      check('subject: an unknown subject loses the exam words', one('י"ב - מתכונת משפטים').subject, 'משפטים');
      check('subject: an unknown subject loses brackets and the bagrut word', one('י"ב - בגרות חינוך גופני (כלל השכבה)').subject, 'חינוך גופני');
      check('subject: spelling variants map to the right subject', [one('י"ב - מתכונת ביולגיה').subject, one('י"ב - מתכונת ביוטכנולגיה').subject, one(`יוד - מבחן ח.תעבורתי מועד ב'`).subject], ['ביולוגיה', 'ביוטכנולוגיה', 'חינוך תעבורתי']);
      check('subject: a line of only exam words keeps its text instead of becoming empty', one('י"ב - מבחן').subject, 'מבחן');
    }
