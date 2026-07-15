export default function Guide({ data }) {
  const m = data.meta
  return (
    <div className="guide">
      <h1>Guide — what everything here means</h1>
      <p className="lead">
        This dashboard is a decision tool, not a scoreboard. Read this once and every number on the other
        tabs will mean what it should — no more, no less.
      </p>

      <div className="gcard">
        <h2>The launch curve</h2>
        <p>
          The headline view plots <strong>cumulative Steam reviews</strong> over time, with every game
          shifted so <strong>week 0 is its launch</strong>. Reviews aren't sales — but their accumulation
          is <em>directly observed</em>, and the <strong>shape</strong> answers the core question: a game
          like ours sells hard at launch, then decays — how fast, and what brings it back (a sale, a Switch
          port, a streamer)? That shape is the most trustworthy thing in the whole dataset.
        </p>
      </div>

      <div className="gcard">
        <h2>"First year" — but which year?</h2>
        <p>
          Because the x-axis is <strong>normalized to each game's own launch</strong>, the window controls
          ("First year", "First 2 years") mean each game's <em>own</em> first N weeks — which land in a
          different calendar year for each. Dome Keeper's first year is 2022–23; SteamWorld Dig's is
          2013–14. That's the point: it lets curves from different eras overlay on one shape.
        </p>
        <p className="callout">
          <strong>To see the real date:</strong> hover any point — the tooltip shows the actual month and
          year for each game at that week. The launch year is also on every game chip.
        </p>
      </div>

      <div className="gcard">
        <h2>The three confidence classes — never blur them</h2>
        <div className="deflist">
          <div className="d"><span className="k"><span className="tagpill tag-hard">HARD</span></span><span className="v">{m.confidence.HARD}. Trust these as facts.</span></div>
          <div className="d"><span className="k"><span className="tagpill tag-est">EST</span></span><span className="v">{m.confidence.EST}. Valve never publishes sales, so units &amp; revenue are always modelled — shown as a low–high band, never a single confident point.</span></div>
          <div className="d"><span className="k"><span className="tagpill tag-anec">ANEC</span></span><span className="v">{m.confidence.ANEC}. Useful anchors, but self-selecting — studios only announce good news.</span></div>
        </div>
      </div>

      <div className="gcard">
        <h2>The metrics</h2>
        <div className="deflist">
          <div className="d"><span className="k">Cumulative</span><span className="v">Total reviews accrued by each week — magnitude and the long tail.</span></div>
          <div className="d"><span className="k">New / week</span><span className="v">Reviews in that week alone — this is where you <em>see</em> the launch spike, the decay rate, and every sale or streamer bump.</span></div>
          <div className="d"><span className="k">% of lifetime</span><span className="v">Cumulative as a share of the game's total — compares curve <em>shape</em> regardless of how big the game is.</span></div>
        </div>
      </div>

      <div className="gcard">
        <h2>Why some games are missing from the curve</h2>
        <p>
          Games with more than ~100k reviews (Terraria, DayZ, Valheim, Deep Rock, 7 Days, ASTRONEER,
          Teardown, Outer Wilds, Enshrouded) appear everywhere <em>except</em> the launch curve. Steam's
          reviews API walks newest-to-oldest and gives out before reaching a million-review game's launch
          week, so their early curve is unrecoverable. Rather than draw a misleading stub, they're flagged
          and excluded from the overlay. They still count as <strong>ceiling markers</strong> — never as
          typical-case peers.
        </p>
      </div>

      <div className="gcard">
        <h2>The tiers</h2>
        <div className="deflist">
          {Object.entries(m.tiers).map(([k, v]) => (
            <div className="d" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
          ))}
        </div>
      </div>

      <div className="gcard">
        <h2>Where the numbers come from</h2>
        <div className="deflist">
          <div className="d"><span className="k">Reviews, dates, prices, tags</span><span className="v">Steam APIs — <span className="tagpill tag-hard">HARD</span>.</span></div>
          <div className="d"><span className="k">Units &amp; revenue</span><span className="v">Gamalytic (the mid) bracketed by a Boxleiter estimate (reviews × 20–40) — <span className="tagpill tag-est">EST</span>. Revenue is <strong>gross</strong>; Valve takes 30%+ and real take-home is well under half.</span></div>
          <div className="d"><span className="k">Company financials</span><span className="v">Filed Nordic / EU annual accounts — <span className="tagpill tag-hard">HARD</span>, but multi-currency and sometimes P&amp;L-restricted.</span></div>
          <div className="d"><span className="k">Sales claims, deal notes</span><span className="v">Dev tweets, interviews, postmortems — <span className="tagpill tag-anec">ANEC</span>.</span></div>
        </div>
      </div>

      <div className="gcard">
        <h2>What this dashboard can't tell you</h2>
        <p>
          Console &amp; mobile sales are essentially invisible (Steam is most of what's knowable). Publisher
          deal terms and private-company valuations are confidential and simply aren't here. Where a
          publisher matters, we show their catalogue's track record instead of terms we'll never get.
        </p>
      </div>
    </div>
  )
}
