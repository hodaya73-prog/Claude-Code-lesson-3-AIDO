    // sample data is valid for both languages
    for (const lang of ['en', 'he']) {
      const d = SP.sample.build(new Date(), lang);
      check('sample (' + lang + ') has exams in the future', d.exams.every((e) => e.startsAt > new Date()), true);
      check('sample (' + lang + ') exam subjects all exist', d.exams.every((e) => d.subjects.some((s) => s.name === e.subject)), true);
      const summary = L.gradeSummary(d.grades, d.subjects, settings);
      check('sample (' + lang + ') overall average computed', summary.overall !== null, true);
    }
