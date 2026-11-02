    // ---- design tokens meet WCAG AA (SPEC §6.7): the colours are read from the real css/styles.css ----
    later(fetch('../css/styles.css')
      .then((r) => r.text())
      .then((css) => {
        const tok = {};
        for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tok[m[1]] = m[2];
        const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        const ratio = (a, b) => { const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
        const need = (fg, bg, min, why) => {
          const ok = tok[fg] && tok[bg] && ratio(tok[fg], tok[bg]) >= min;
          check('contrast ' + fg + ' on ' + bg + ' ≥ ' + min + ':1 (' + why + ')' + (tok[fg] && tok[bg] ? ' = ' + ratio(tok[fg], tok[bg]).toFixed(2) : ' — token missing'), !!ok, true);
        };
        for (const bg of ['bg', 'surface', 'surface-2']) { need('text', bg, 4.5, 'body text'); need('text-muted', bg, 4.5, 'secondary text'); }
        for (const fg of ['accent', 'ok', 'warn', 'urgent']) need(fg, 'surface', 4.5, 'coloured text');
        need('primary', 'surface', 4.5, 'accent used as text');
        need('primary', 'surface-2', 4.5, 'accent used as text');
        need('bg', 'primary', 4.5, 'dark label on the primary button');
        need('bg', 'accent', 4.5, 'dark label on the button gradient end');
        for (const bg of ['bg', 'surface', 'surface-2']) need('border-strong', bg, 3, 'boundary of buttons, chips and fields');
      })
      // ---- phone-first (decision D17): the real page in a 375 px frame must not scroll sideways ----
      .then(() => new Promise((resolve) => {
        const f = document.createElement('iframe');
        f.src = '../index.html';
        f.style.cssText = 'position:absolute;left:-9999px;top:0;width:375px;height:800px;border:0';
        f.onload = () => setTimeout(() => {
          const d = f.contentDocument.documentElement;
          check('phone layout: no sideways scroll at 375 px (scrollWidth ' + d.scrollWidth + ' ≤ clientWidth ' + d.clientWidth + ')', d.scrollWidth <= d.clientWidth, true);
          f.remove();
          resolve();
        }, 500);
        document.body.appendChild(f);
      }))
      .catch(() => check('design tokens: css/styles.css can be read', false, true)));
