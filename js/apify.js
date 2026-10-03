/* Apify (https://apify.com) — "Study videos" screen. The student's own Apify token runs the public YouTube Scraper
   actor from the browser (the Apify API allows cross-origin requests with an Authorization header). Pure helpers
   (query, normalising, formatting) are kept apart from the network call so tests.html can cover them. */
(function () {
  const SP = (window.SP = window.SP || {});

  const ACTOR = 'streamers~youtube-scraper';
  const MAX_VIDEOS = 8;
  const SUFFIX = { he: 'שיעור הסבר', en: 'lesson explained' };

  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  // "Math" + "quadratic equations" → "Math quadratic equations lesson explained"
  function buildQuery(subject, topic, lang) {
    return [clean(subject), clean(topic), SUFFIX[lang] || SUFFIX.en].filter(Boolean).join(' ');
  }

  // data from a third party: only https links are kept, so nothing like javascript: can end up in an href
  const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\//i.test(u.trim()) ? u.trim() : '');

  // "00:03:17" → "3:17", "29:54" stays, "1:02:03" stays; anything else → ''
  function normDuration(d) {
    const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(clean(d));
    if (!m) return '';
    const h = m[1] ? Number(m[1]) : 0;
    const min = Number(m[2]);
    return (h ? h + ':' + String(min).padStart(2, '0') : String(min)) + ':' + m[3];
  }

  // Raw dataset items → the videos the screen shows: valid, without duplicates, most viewed first.
  function normalizeVideos(items) {
    const seen = new Set();
    const out = [];
    for (const it of Array.isArray(items) ? items : []) {
      const url = httpsUrl(it && it.url);
      const title = clean(it && it.title);
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      const views = Number(it.viewCount);
      out.push({
        title,
        url,
        thumb: httpsUrl(it.thumbnailUrl),
        views: isFinite(views) && views >= 0 ? views : 0,
        channel: clean(it.channelName),
        duration: normDuration(it.duration),
        date: clean(it.date).slice(0, 10),
      });
    }
    return out.sort((a, b) => b.views - a.views);
  }

  function summarize(videos) {
    return {
      count: videos.length,
      topViews: videos.reduce((m, v) => Math.max(m, v.views), 0),
      totalViews: videos.reduce((s, v) => s + v.views, 0),
      channels: new Set(videos.map((v) => v.channel).filter(Boolean)).size,
    };
  }

  // 410458 → "410K" / Hebrew "410 אלף"
  const formatCount = (n, lang) => new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

  // Runs the YouTube Scraper and waits for the result (Apify answers within 300 s, or with HTTP 408).
  // Errors carry the HTTP status so the screen can say what to fix.
  async function searchVideos(token, query) {
    const url = 'https://api.apify.com/v2/acts/' + ACTOR + '/run-sync-get-dataset-items?timeout=180&format=json&clean=true';
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchQueries: [query], maxResults: MAX_VIDEOS, maxResultsShorts: 0, maxResultStreams: 0 }),
    });
    if (!res.ok) {
      const err = new Error('http ' + res.status);
      err.status = res.status;
      throw err;
    }
    return normalizeVideos(await res.json());
  }

  // Example videos for the "show demo" button (no network, no links, clearly marked as examples in the UI)
  function demoVideos(subject, lang) {
    const he = lang === 'he';
    const names = he
      ? ['סיכום מלא בשעה אחת', 'הסבר שלב אחר שלב', 'תרגול לקראת המבחן', 'טעויות נפוצות ואיך להימנע מהן']
      : ['Full summary in one hour', 'Step-by-step explanation', 'Practice before the test', 'Common mistakes and how to avoid them'];
    const views = [412000, 187000, 96500, 41200];
    const durations = ['58:12', '24:40', '31:05', '12:18'];
    return names.map((n, i) => ({ title: clean(subject) + ' — ' + n, url: '', thumb: '', views: views[i], channel: he ? 'ערוץ לדוגמה' : 'Example channel', duration: durations[i], date: '' }));
  }

  Object.assign(SP, { apify: { ACTOR, MAX_VIDEOS, buildQuery, normalizeVideos, normDuration, summarize, formatCount, searchVideos, demoVideos } });
})();
