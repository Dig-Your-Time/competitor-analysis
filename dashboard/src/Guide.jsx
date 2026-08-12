export default function Guide({ data }) {
  const m = data.meta
  const nCurves = Object.keys(data.launch_curves || {}).length
  return (
    <div className="guide">
      <h1>Guide: what everything here means</h1>
      <p className="lead">
        This dashboard is a decision tool, not a scoreboard. Read this once and every number on the other
        tabs will mean what it should, no more and no less.
      </p>

      <div className="gcard">
        <h2>The launch curve</h2>
        <p>
          The headline view plots <strong>cumulative Steam reviews</strong> over time, with every game
          shifted so <strong>week 0 is its launch</strong>. Reviews aren't sales, but their accumulation
          is <em>directly observed</em>, and the <strong>shape</strong> answers the core question. A game
          like ours sells hard at launch, then decays: how fast, and what brings it back (a sale, a Switch
          port, a streamer)? That shape is the most trustworthy thing in the whole dataset.
        </p>
      </div>

      <div className="gcard">
        <h2>"First year", but which year?</h2>
        <p>
          Because the x-axis is <strong>normalized to each game's own launch</strong>, the window controls
          ("First year", "First 2 years") mean each game's <em>own</em> first N weeks, which land in a
          different calendar year for each. Dome Keeper's first year is 2022 to 2023; SteamWorld Dig's is
          2013 to 2014. That's the point: it lets curves from different eras overlay on one shape.
        </p>
        <p className="callout">
          <strong>To see the real date:</strong> hover any point and the tooltip shows the actual month and
          year for each game at that week. The launch year is also on every game chip.
        </p>
      </div>

      <div className="gcard">
        <h2>Reading the Compare view and the estimate band</h2>
        <p>
          Compare ranks your picked games on two bars, then breaks every metric out in a table below.
          The <strong>Reviews</strong> bar is <span className="tagpill tag-hard">HARD</span>, one solid
          fill, a fact. The <strong>Est. units</strong> bar is deliberately <em>not</em> a single point:
          the shaded band spans the <strong>low to high estimate</strong> and the tick marks the
          <strong> mid</strong>.
        </p>
        <p>
          Read the band's <strong>width as your confidence</strong>. The band is <em>Gamalytic's own</em>
          low-to-high range for that game, read off its page — not a spread between two estimators. A
          tight band means the model is confident; a wide one means it isn't, so the "number" could be
          off by a lot. Two studios can show the same mid yet mean very different things once you look
          at how wide each one's band is.
        </p>
        <p>
          For the disagreement <em>between</em> estimators, open a game's own page: it lists Boxleiter,
          GameSensor and Gamalytic side by side rather than averaging them. On small games they differ
          by 2–4×, which is a far bigger uncertainty than any one vendor's band admits to.
        </p>
        <p className="callout">
          <strong>Don't compare revenue to our own net figure.</strong> Est. gross revenue is before
          Valve's 30%+ cut, regional pricing, and discounts, so real take-home is well under half.
        </p>
      </div>

      <div className="gcard">
        <h2>The three confidence classes: never blur them</h2>
        <div className="deflist">
          <div className="d"><span className="k"><span className="tagpill tag-hard">HARD</span></span><span className="v">{m.confidence.HARD}. Trust these as facts.</span></div>
          <div className="d"><span className="k"><span className="tagpill tag-est">EST</span></span><span className="v">{m.confidence.EST}. Valve never publishes sales, so units &amp; revenue are always modelled, and shown as a low to high band, never a single confident point.</span></div>
          <div className="d"><span className="k"><span className="tagpill tag-anec">ANEC</span></span><span className="v">{m.confidence.ANEC}. Useful anchors, but self-selecting, since studios only announce good news.</span></div>
        </div>
      </div>

      <div className="gcard">
        <h2>The metrics</h2>
        <div className="deflist">
          <div className="d"><span className="k">Cumulative</span><span className="v">Total reviews accrued by each week: magnitude and the long tail.</span></div>
          <div className="d"><span className="k">New / week</span><span className="v">Reviews in that week alone. This is where you <em>see</em> the launch spike, the decay rate, and every sale or streamer bump.</span></div>
          <div className="d"><span className="k">% of lifetime</span><span className="v">Cumulative as a share of the game's total. Compares curve <em>shape</em> regardless of how big the game is.</span></div>
        </div>
      </div>

      <div className="gcard">
        <h2>Every game has a curve — but read the edges honestly</h2>
        <p>
          All {nCurves} tracked games appear in the overlay, big ones included. Counting
          a week at a time off Steam's own review index costs the same whether a week holds 3 reviews or
          30,000, so a million-review game is no longer unreachable — the old limit that dropped Terraria,
          DayZ and Valheim from this view is gone. Coverage is <strong>measured</strong> against each game's
          lifetime review total rather than assumed, and anything that recovers under 90% is flagged in the
          chart's own notes.
        </p>
        <p>
          What still needs care: weeks <strong>before 0</strong> are Early Access, not a pre-launch mystery;
          a line that <strong>starts late</strong> has no launch spike to read; and the big multiplayer games
          remain <strong>ceiling markers</strong>, never typical-case peers, however complete their curves are.
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
          <div className="d"><span className="k">Reviews, dates, prices, tags</span><span className="v">Steam APIs. <span className="tagpill tag-hard">HARD</span>.</span></div>
          <div className="d"><span className="k">Price</span><span className="v">Always the <strong>list price</strong>, never the sale price. Steam reports both, and a game that happened to be 75% off on the day we fetched is not a $7 game — filing the discount would put it in the wrong bracket on the market map, the one chart meant to inform our own pricing. Shown in <strong>two regions</strong>: the US dollar price and the Finnish euro price, both fetched. Steam sets regional prices <em>per region</em> rather than converting, so these are two separate decisions by the publisher — Hydroneer is €15.49 against $14.99, Outer Wilds €22.99 against $24.99. Caveat: this is <em>today&apos;s</em> list price, re-fetched on every run because prices move. A studio that permanently repriced shows the new number; Steam exposes no price history.</span></div>
          <div className="d"><span className="k">Launch curves</span><span className="v">Weekly review counts read straight off Steam&apos;s review index, one week at a time, so cost doesn&apos;t scale with a game&apos;s size and <strong>every tracked game has a curve</strong>. Weeks before 0 are Early Access: a game whose Steam release date is its 1.0 date can have years of sales to the left of &quot;launch&quot;.</span></div>
          <div className="d"><span className="k">Units &amp; revenue</span><span className="v">Gamalytic's own low / mid / high, read off its page for each game. <span className="tagpill tag-est">EST</span>. A Boxleiter figure (reviews × 30) and GameSensor's are kept alongside on each game page as competing estimates, never blended in. Revenue is <strong>gross</strong>; Valve takes 30%+ and real take-home is well under half. Caveat: Gamalytic <em>truncates</em> what it displays — a modelled 1,174,095 renders as &quot;1.1m&quot; — so the stored figure is the displayed one and runs slightly low, on average 1.3% and at worst 6%.</span></div>
          <div className="d"><span className="k">Company financials</span><span className="v">Filed Nordic and EU annual accounts. <span className="tagpill tag-hard">HARD</span>, but multi-currency and sometimes P&amp;L-restricted.</span></div>
          <div className="d"><span className="k">Sales claims, deal notes</span><span className="v">Dev tweets, interviews, postmortems. <span className="tagpill tag-anec">ANEC</span>.</span></div>
          <div className="d"><span className="k">Currency</span><span className="v">All <strong>estimated and filed money is shown in EUR</strong>, converted at fixed approximate rates (the exact rates and per-currency detail appear on a studio's source panel). The one exception is a game's <strong>listed Steam price</strong>. Its euro figure is <em>not</em> converted — it is Steam's actual Finnish store price, fetched separately, because Valve's regional pricing is set per region rather than derived from the dollar figure.</span></div>
        </div>
      </div>

      <div className="gcard">
        <h2>The Regions view, and why Finland comes first</h2>
        <p>
          Each bubble is a game, grouped by its studio's home region and sized by
          <strong> reviews</strong> (HARD) or <strong>est. units</strong> (EST). Size is a
          <strong> square-root</strong> scale, so read it as rank and rough magnitude, because the giants
          would otherwise flatten everything else. Colour shows whether a studio is still independent or has
          been acquired.
        </p>
        <p>
          Finland leads the layout on purpose. Nordic limited companies must <strong>file public annual
          accounts</strong>, so for a large slice of this field we have real revenue and margins, not just
          estimates. That's a competitive edge a non-Nordic researcher can't replicate, which is why several
          of the most useful, filings-backed comparables sit right at the top of this view.
        </p>
      </div>

      <div className="gcard">
        <h2>Company financials: real numbers, with caveats</h2>
        <p>
          Unlike units and revenue <em>estimates</em>, filed annual accounts are
          <span className="tagpill tag-hard">HARD</span>. Nordic and EU limited companies are legally
          required to publish them. Each bar is one fiscal year's <strong>revenue</strong>; the figure
          beside it is <strong>net profit</strong> (or operating, tagged <em>op</em>) with margin.
        </p>
        <p>
          Two honesty caveats. First, euro conversion uses <strong>fixed approximate rates</strong> across
          filings from different years, which is good for ranking studios, not for accounting. Second,
          <strong> disclosure differs by country</strong>: small German studios file no profit-and-loss at
          all, and Danish companies report <em>gross profit</em> rather than revenue, so those sit in a
          separate restricted list rather than being shown as zero. And note a hit's revenue is
          <strong> lumpy</strong>: Iron Gate's Valheim went 533M → 94M SEK in a year, so one big number
          is a spike, not a run-rate.
        </p>
      </div>

      <div className="gcard">
        <h2>Publishers: track record, never terms</h2>
        <p>
          Deal terms (advances, revenue splits) are confidential and simply aren't obtainable. So this
          view answers the question you <em>can</em> answer: does a publisher's catalogue tend to do well,
          and how do self-published games compare? It uses <strong>medians</strong> so a single breakout
          doesn't distort the picture.
        </p>
        <p>
          The crucial caveat: all revenue is <strong>gross</strong> <span className="tagpill tag-est">EST</span>,
          the whole pie before Valve's cut <em>and</em> before the publisher's share. A self-published studio
          keeps most of each euro; a publisher-backed one gives away a slice you can't see, so a bigger gross
          under a publisher doesn't mean more money reached the developer. And with only a couple of publishers
          holding more than one title here, treat this as a <strong>signal, not a verdict</strong>.
        </p>
      </div>

      <div className="gcard">
        <h2>Funding &amp; ownership: the sparse, uncertain corner</h2>
        <p>
          This is the least complete view, and honestly so. Ownership is solid: who's independent, and who was
          acquired by Embracer, Microsoft, Devolver, or has a Tencent minority stake. Funding is thin.
          <strong> Crowdfunding</strong> amounts are <span className="tagpill tag-hard">HARD</span> (public
          campaigns), but acquisition prices and investment rounds are <span className="tagpill tag-anec">ANEC</span>:
          announced in press, often approximate, and frequently just <strong>undisclosed</strong>.
        </p>
        <p>
          Two things to keep straight. An <strong>acquisition price is what a buyer paid</strong> for the
          whole studio, not capital raised to make a game, so it isn't comparable to a funding round. And
          <strong> valuations are deliberately absent</strong>: for studios this size they aren't public, and
          a made-up valuation is exactly the kind of guess-as-fact this project refuses to show.
        </p>
      </div>

      <div className="gcard">
        <h2>Sources: click almost anything</h2>
        <p>
          Every game title and studio name marked with a small <span className="srccue">ⓘ</span> is
          clickable. It opens a panel showing where each fact comes from: a <strong>reliability label</strong>,
          what the source documents, and a link you can <strong>visit</strong>. Steam facts link to the store
          page; estimates link to Gamalytic; a studio's registry, filed accounts, and funding each carry their
          own citation.
        </p>
        <p>The reliability label tells you how much to trust a source, from strongest to weakest:</p>
        <div className="deflist deflist-rel">
          <div className="d"><span className="k"><span className="relbadge rel-primary">Primary</span></span><span className="v">The original official record: a company filing, a government registry, or a first-party announcement. The strongest kind.</span></div>
          <div className="d"><span className="k"><span className="relbadge rel-secondary">Reputable secondary</span></span><span className="v">A trusted third party reporting on it, such as an established news outlet or a company-accounts aggregator.</span></div>
          <div className="d"><span className="k"><span className="relbadge rel-self">Self-reported</span></span><span className="v">The studio's own claim (a tweet, blog, or interview). Useful, but studios mostly announce good news.</span></div>
          <div className="d"><span className="k"><span className="relbadge rel-unverified">Unverified</span></span><span className="v">A single weak or unconfirmed source. Treat it with caution.</span></div>
        </div>
        <p style={{ marginTop: 12 }}>
          Where a source is fragile (a dev's tweet, or a studio blog that will 404 when the studio dies), an
          <strong> Archived</strong> link is kept alongside the live one, because in this dataset some of
          those studios <em>will</em> die and their best sales claim is the first thing to vanish.
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
