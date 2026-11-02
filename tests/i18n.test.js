    // ---- UI strings: English and Hebrew must stay in step (SPEC §7). A missing Hebrew string would silently show English. ----
    {
      const I = SP.i18n;
      const keys = (o) => Object.keys(o).sort();
      // Hebrew has a dual form ("שני ציונים", "יומיים") that English does not need: keys ending in "Two" exist only in Hebrew
      const hebrewOnly = (k) => /Two$/.test(k);
      check('i18n: every English string has a Hebrew translation', keys(I.en).filter((k) => !(k in I.he)), []);
      check('i18n: every Hebrew string has an English one (except the Hebrew-only dual forms)', keys(I.he).filter((k) => !(k in I.en) && !hebrewOnly(k)), []);
      const placeholders = (s) => (typeof s === 'string' ? (s.match(/\{[a-zA-Z]+\}/g) || []).sort().join(',') : '');
      check('i18n: both languages use the same {placeholders}', keys(I.en).filter((k) => k in I.he && placeholders(I.en[k]) !== placeholders(I.he[k])), []);
      check('i18n: no string is empty', keys(I.en).concat(keys(I.he)).filter((k) => I.en[k] === '' || I.he[k] === ''), []);
      check('i18n: lists (weekday names) have the same length', keys(I.en).filter((k) => Array.isArray(I.en[k]) && I.en[k].length !== (I.he[k] || []).length), []);
      check('i18n: exam type names exist in both languages', ['quiz', 'test', 'exam', 'project', 'bagrut'].filter((k) => !I.en.types[k] || !I.he.types[k]), []);
    }

    // ---- translation helpers ----
    {
      const I = SP.i18n, tHe = I.makeT('he'), tEn = I.makeT('en');
      check('t(): fills {placeholders}', tEn('updated', { t: '3 min ago' }), 'Updated 3 min ago');
      check('t(): Hebrew text', tHe('close'), 'סגירה');
      check('t(): unknown key falls back to English, then to nothing', [tHe('definitely_missing_key') === undefined, tEn('close')], [true, 'Close']);
      check('daysPhrase: today / tomorrow', [I.daysPhrase(0, 'en', tEn), I.daysPhrase(1, 'en', tEn)], ['today', 'tomorrow']);
      check('daysPhrase: Hebrew dual form for two days', I.daysPhrase(2, 'he', tHe), 'בעוד יומיים');
      check('daysPhrase: several days', I.daysPhrase(5, 'en', tEn), 'in 5 days');
      check('durationText: hours and minutes (en)', I.durationText(95, 'en'), '1h 35m');
      check('durationText: hours and minutes (he)', I.durationText(95, 'he'), '1 ש׳ 35 ד׳');
      check('durationText: whole hours, minutes only, and zero', [I.durationText(120, 'en'), I.durationText(45, 'en'), I.durationText(0, 'en')], ['2h', '45m', '0m']);
      check('durationText: negative values are clamped to zero', I.durationText(-5, 'en'), '0m');
    }
