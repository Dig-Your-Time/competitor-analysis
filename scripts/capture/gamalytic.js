// Run in the browser console on https://gamalytic.com/game/<steam_appid>
// Returns one JSON line. Collect one per game into an array, then:
//   python scripts/import_vendor_capture.py gamalytic <file.json>
//
// The API is paywalled, so this is read from the page a signed-in human is looking at.
(async () => {
  await new Promise((r) => setTimeout(r, 3200));            // the stats block renders late
  const T = document.body.innerText.replace(/ /g, ' ');

  // Gamalytic labels revenue TWO ways: "Gross revenue (base game):" when the game has
  // DLC, plain "Gross revenue:" when it doesn't. Requiring the parenthetical silently
  // lost revenue for 5 of 28 games and wrote 0 without complaining. Match both.
  const band = (re) => { const m = T.match(re); return m ? [m[1], m[2], m[3]] : null };
  const copies = band(/Copies sold:\s*([\d.]+[kmb]?)\s*\(([\d.]+[kmb]?)\s*-\s*([\d.]+[kmb]?)\)/i);
  const revenue = band(/Gross revenue(?:\s*\(base game\))?:\s*\$([\d.]+[kmb]?)\s*\(\$([\d.]+[kmb]?)\s*-\s*\$([\d.]+[kmb]?)\)/i);

  // Country names live ONLY in each flag's alt attribute; the text is just "~ 24.0%".
  // The free tier caps this at the top 3 plus an "others" bucket.
  const pctNodes = [...document.querySelectorAll('*')]
    .filter((e) => !e.children.length && /^~\s*[\d.]+%$/.test(e.textContent.trim()));
  const countries = pctNodes.map((e) => {
    const row = e.closest('div')?.parentElement;
    const img = row ? row.querySelector('img') : null;
    return {
      cc: img ? (img.getAttribute('alt') || '').toUpperCase() : 'OTHERS',
      pct: parseFloat(e.textContent.replace(/[^\d.]/g, '')),
    };
  });

  // The rest of the Stats block. These refresh gamalytic_stats.csv, whose pasted
  // export drifts: between 2026-07-15 and 2026-08-12 Moonlighter's gross moved
  // $8.7m -> $9.8m (+13%) and SteamWorld Dig 2's fell 13%.
  const one = (re) => { const m = T.match(re); return m ? m[1].trim() : null };
  const out = {
    game_id: location.pathname.split('/').pop(),
    copies, revenue, countries,
    players: one(/Players total:\s*([\d.]+[kmb]?)/i),
    owners: one(/Owners:\s*([\d.]+[kmb]?)/i),
    reviews: one(/Reviews:\s*([\d.]+[kmb]?)/i),
    review_score: one(/Review score:\s*([\d.]+)%/i),
    playtime_hours: one(/Average playtime:\s*([\d.]+)h/i),
    ccu: one(/Average daily concurrent players:\s*([\d.,]+)/i),
    followers: one(/Followers:\s*([\d.]+[kmb]?)/i),
    shown: {
      copies: copies ? `${copies[0]} (${copies[1]} - ${copies[2]})` : '',
      revenue: revenue ? `$${revenue[0]} ($${revenue[1]} - $${revenue[2]})` : '',
    },
  };
  console.log(JSON.stringify(out));
  return out;
})();
