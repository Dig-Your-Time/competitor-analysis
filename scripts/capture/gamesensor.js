// Run in the browser console on https://gamesensor.info/app/<steam_appid>
// Returns one JSON line. Collect one per game into an array, then:
//   python scripts/import_vendor_capture.py gamesensor <file.json>
//
// The site is behind a Cloudflare bot challenge, which a real browser passes by running
// the JS it asks for. Do not try to defeat it from a script.
(async () => {
  // The language table is rendered client-side and only after it scrolls into view --
  // fetching this page's HTML same-origin returns zero .one_lang rows.
  const h = [...document.querySelectorAll('h3')].find((e) => /Player Language/.test(e.textContent));
  if (h) h.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 2200));

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // Each headline sits in its own .title_white_box, and textContent runs the label
  // straight into the value with no space: "Total GrossTotal Net$6M$4M". Match inside
  // one box at a time; a character class containing "$" will over-match across both.
  const boxes = [...document.querySelectorAll('.title_white_box')].map((b) => clean(b.textContent));
  const pick = (re) => { for (const t of boxes) { const m = t.match(re); if (m) return m } return null };
  const gn = pick(/Total Gross\s*Total Net\s*([$€£]?[\d.,]+[KMB]?)\s*([$€£]?[\d.,]+[KMB]?)/i);
  const cs = pick(/Copies Sold\s*([\d.,]+[KMB]?)/i);

  // .right holds two percentages in order: SALES (revenue share) then OWNERS (copies
  // share). Russian is consistently higher on owners than sales because of regional
  // pricing, which is how the column order was confirmed.
  const langs = [...document.querySelectorAll('.one_lang')].map((x) => {
    const L = clean(x.querySelector('.left')?.textContent);
    const R = clean(x.querySelector('.right')?.textContent);
    const p = (R.match(/[\d.]+%/g) || []).map((v) => parseFloat(v));
    return {
      gs_language: L.replace(/Supported$/i, '').trim(),
      supported: /Supported$/i.test(L),
      revenue_pct: p[0] ?? null,
      copies_pct: p[1] ?? null,
    };
  });

  const out = {
    game_id: location.pathname.split('/').pop(),
    gross: gn ? gn[1] : null, net: gn ? gn[2] : null, copies: cs ? cs[1] : null,
    langs,
  };
  console.log(JSON.stringify(out));
  return out;
})();
