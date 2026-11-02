    // ---- Apify: study videos ----
    const A = SP.apify;
    check('apify: query joins subject, topic and the language suffix', A.buildQuery('מתמטיקה', 'משוואות ריבועיות', 'he'), 'מתמטיקה משוואות ריבועיות שיעור הסבר');
    check('apify: query without topic, English', A.buildQuery('  Math ', '', 'en'), 'Math lesson explained');
    const vids = A.normalizeVideos([
      { title: 'B', url: 'https://www.youtube.com/watch?v=b', viewCount: 100, channelName: 'Ch', duration: '00:03:17', date: '2024-05-01T10:00:00.000Z', thumbnailUrl: 'https://i.ytimg.com/b.jpg' },
      { title: 'A', url: 'https://www.youtube.com/watch?v=a', viewCount: 5000, duration: '1:02:03' },
      { title: 'dup of A', url: 'https://www.youtube.com/watch?v=a', viewCount: 9 },
      { title: 'unsafe link', url: 'javascript:alert(1)', viewCount: 99999 },
      { title: '', url: 'https://www.youtube.com/watch?v=c' },
      { title: 'no views', url: 'https://www.youtube.com/watch?v=d', thumbnailUrl: 'http://insecure/x.jpg' },
      null,
    ]);
    check('apify: unsafe, empty and duplicate items are dropped', vids.map((v) => v.title), ['A', 'B', 'no views']);
    check('apify: most viewed first, missing views = 0', vids.map((v) => v.views), [5000, 100, 0]);
    check('apify: duration 00:03:17 → 3:17', vids[1].duration, '3:17');
    check('apify: duration 1:02:03 stays', vids[0].duration, '1:02:03');
    check('apify: date keeps the day only', vids[1].date, '2024-05-01');
    check('apify: http thumbnail is dropped', vids[2].thumb, '');
    check('apify: summary', A.summarize(vids), { count: 3, topViews: 5000, totalViews: 5100, channels: 1 });
    check('apify: non-array response → no videos', A.normalizeVideos({ error: 'x' }), []);
    check('apify: demo videos have no links', A.demoVideos('Math', 'en').every((v) => v.url === ''), true);
    check('apify: compact view counts', A.formatCount(410458, 'en'), '410.5k');
