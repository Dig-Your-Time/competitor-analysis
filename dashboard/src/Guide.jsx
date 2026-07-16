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
        <h2>Reading the Compare view — and the estimate band</h2>
        <p>
          Compare ranks your picked games on two bars, then breaks every metric out in a table below.
          The <strong>Reviews</strong> bar is <span className="tagpill tag-hard">HARD</span> — one solid
          fill, a fact. The <strong>Est. units</strong> bar is deliberately <em>not</em> a single point:
          the shaded band spans the <strong>low–high estimate</strong> and the tick marks the
          <strong> mid</strong>.
        </p>
        <p>
          Read the band's <strong>width as your confidence</strong>. A tight band means the two
          independent estimators (Gamalytic and Boxleiter) roughly agree; a wide one means they don't —
          so the "number" could be off by a lot. Two studios can show the same mid yet mean very different
          things once you look at how wide each one's band is.
        </p>
        <p className="callout">
          <strong>Don't compare revenue to our own net figure.</strong> Est. gross revenue is before
          Valve's 30%+ cut, regional pricing, and discounts — real take-home is well under half.
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
        <h2>The Regions view — and why Finland comes first</h2>
        <p>
          Each bubble is a game, grouped by its studio's home region and sized by
          <strong> reviews</strong> (HARD) or <strong>est. units</strong> (EST). Size is a
          <strong> square-root</strong> scale, so read it as rank and rough magnitude — the giants would
          otherwise flatten everything else. Colour shows whether a studio is still independent or has been
          acquired.
        </p>
        <p>
          Finland leads the layout on purpose. Nordic limited companies must <strong>file public annual
          accounts</strong>, so for a large slice of this field we have real revenue and margins, not just
          estimates — a competitive edge a non-Nordic researcher can't replicate. That's why several of the
          most useful, filings-backed comparables sit right at the top of this view.
        </p>
      </div>

      <div className="gcard">
        <h2>Company financials — real numbers, with caveats</h2>
        <p>
          Unlike units and revenue <em>estimates</em>, filed annual accounts are
          <span className="tagpill tag-hard">HARD</span> — Nordic and EU limited companies are legally
          required to publish them. Each bar is one fiscal year's <strong>revenue</strong>; the figure
          beside it is <strong>net profit</strong> (or operating, tagged <em>op</em>) with margin.
        </p>
        <p>
          Two honesty caveats. First, euro conversion uses <strong>fixed approximate rates</strong> across
          filings from different years — good for ranking studios, not for accounting. Second,
          <strong> disclosure differs by country</strong>: small German studios file no profit-and-loss at
          all, and Danish companies report <em>gross profit</em> rather than revenue, so those sit in a
          separate restricted list rather than being shown as zero. And note a hit's revenue is
          <strong> lumpy</strong> — Iron Gate's Valheim went 533M → 94M SEK in a year — so one big number
          is a spike, not a run-rate.
        </p>
      </div>

      <div className="gcard">
        <h2>Publishers — track record, never terms</h2>
        <p>
          Deal terms — advances, revenue splits — are confidential and simply aren't obtainable. So this
          view answers the question you <em>can</em> answer: does a publisher's catalogue tend to do well,
          and how do self-published games compare? It uses <strong>medians</strong> so a single breakout
          doesn't distort the picture.
        </p>
        <p>
          The crucial caveat: all revenue is <strong>gross</strong> <span className="tagpill tag-est">EST</span>,
          the whole pie before Valve's cut <em>and</em> before the publisher's share. A self-published studio
          keeps most of each euro; a publisher-backed one gives away a slice you can't see — so a bigger gross
          under a publisher doesn't mean more money reached the developer. And with only a couple of publishers
          holding more than one title here, treat this as a <strong>signal, not a verdict</strong>.
        </p>
      </div>

      <div className="gcard">
        <h2>Funding &amp; ownership — the sparse, uncertain corner</h2>
        <p>
          This is the least complete view, and honestly so. Ownership is solid — who's independent, who was
          acquired by Embracer, Microsoft, Devolver, or has a Tencent minority stake. Funding is thin:
          <strong> crowdfunding</strong> amounts are <span className="tagpill tag-hard">HARD</span> (public
          campaigns), but acquisition prices and investment rounds are <span className="tagpill tag-anec">ANEC</span> —
          announced in press, often approximate, and frequently just <strong>undisclosed</strong>.
        </p>
        <p>
          Two things to keep straight: an <strong>acquisition price is what a buyer paid</strong> for the
          whole studio, not capital raised to make a game — so it isn't comparable to a funding round. And
          <strong> valuations are deliberately absent</strong>: for studios this size they aren't public, and
          a made-up valuation is exactly the kind of guess-as-fact this project refuses to show.
        </p>
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
