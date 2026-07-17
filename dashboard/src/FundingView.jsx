import { fmt, toEur, nativeAmt } from './lib.js'
import { useDrawer } from './drawer.jsx'
import { ViewHead } from './ui.jsx'

// bucket a round into a human category from its stage + investor + note text
const categorize = (r) => {
  const n = (r.note || '').toLowerCase()
  const inv = (r.investors || '').toLowerCase()
  if (n.includes('acquisition') || n.includes('buyout')) return 'Acquisition'
  if (inv.includes('kickstarter') || inv.includes('fig ') || n.includes('kickstarter') || n.includes('fig ')) return 'Crowdfunding'
  if (r.funding_stage === 'Grant') return 'Grant'
  if (r.funding_stage === 'Publisher advance') return 'Publisher advance'
  if ((n.includes('minority') || n.includes('strategic')) && r.amount == null) return 'Strategic stake'
  return 'Investment round'
}

const CAT_ORDER = ['Acquisition', 'Investment round', 'Strategic stake', 'Crowdfunding', 'Grant', 'Publisher advance']
const CAT_NOTE = {
  Acquisition: 'A studio bought outright. The price is what the buyer paid, not what the studio raised.',
  'Investment round': 'Capital raised into the company.',
  'Strategic stake': 'A minority stake. The studio stays independent, and amounts are almost never disclosed.',
  Crowdfunding: 'Money from players before launch, the only HARD figures here.',
  Grant: 'Non-dilutive public money.',
  'Publisher advance': 'A recoupable advance against future sales.',
}

const conf = (c) => (c === 'HARD' ? 'tag-hard' : c === 'ANEC' ? 'tag-anec' : 'tag-est')
const shortDate = (d) => (d ? d.slice(0, 7) : '—')

export default function FundingView({ data }) {
  const { open } = useDrawer()
  const funding = data.funding || []
  const companies = data.companies || []

  // flatten every round, tag it with its studio + category
  const events = []
  funding.forEach((f) =>
    f.rounds.forEach((r) => events.push({ ...r, company_name: f.company_name, company_id: f.company_id, cat: categorize(r) }))
  )
  const byCat = CAT_ORDER.map((c) => [c, events.filter((e) => e.cat === c)]).filter(([, es]) => es.length)

  // who's got a minority strategic investor (Tencent etc.) — badge onto independents
  const minorityOf = {}
  events.filter((e) => e.cat === 'Strategic stake').forEach((e) => {
    const inv = e.investors.split(/[,(]/)[0].trim()
    minorityOf[e.company_id] = inv
  })

  // ownership: acquired studios grouped by ultimate owner; the rest independent
  const ownerKey = (p) => p.split('(')[0].trim()
  const acquired = companies.filter((c) => c.parent_company)
  const independent = companies.filter((c) => !c.parent_company)
  const owners = {}
  acquired.forEach((c) => (owners[ownerKey(c.parent_company)] ??= []).push(c))
  const ownerRows = Object.entries(owners).sort((a, b) => b[1].length - a[1].length)

  return (
    <div>
      <ViewHead
        title="Funding & ownership"
        subtitle="Who paid in, and who owns them now. The sparse, least-certain corner of the dataset."
        infoWidth={440}
        info={<><b>Ownership</b> shows who's still independent versus who was acquired and by whom. <b>Funding events</b> lists the money, bucketed by kind. Only crowdfunding is HARD; acquisition prices and stakes are ANEC, reported in press, often approximate. An <b>acquisition price is what a buyer paid</b>, not money the studio raised, so don't read the big numbers as runway.</>}
      />

      <h2 className="finsechead" style={{ marginTop: 0 }}>Ownership</h2>
      <div className="owngrid">
        <div className="owncard indie">
          <div className="ownhead"><span className="ownname">Independent</span><span className="owncount">{independent.length}</span></div>
          <div className="ownlist">
            {independent.map((c) => (
              <div className="ownstudio clickable" key={c.company_id} onClick={() => open({ type: 'studio', id: c.company_id })} title="View sources">
                <span>{c.company_name.split('(')[0].trim()} <span className="srccue">ⓘ</span></span>
                {minorityOf[c.company_id] && <span className="minbadge">{minorityOf[c.company_id]} minority</span>}
              </div>
            ))}
          </div>
        </div>
        {ownerRows.map(([owner, cos]) => (
          <div className="owncard" key={owner}>
            <div className="ownhead"><span className="ownname">{owner}</span><span className="owncount">{cos.length}</span></div>
            <div className="ownlist">
              {cos.map((c) => (
                <div className="ownstudio clickable" key={c.company_id} title={c.parent_company} onClick={() => open({ type: 'studio', id: c.company_id })}>
                  <span>{c.company_name.split('(')[0].trim()} <span className="srccue">ⓘ</span></span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="finsechead">Funding events</h2>
      {byCat.map(([cat, es]) => (
        <div className="fundcat" key={cat}>
          <div className="fundcat-h">
            <span className="fundcat-t">{cat}</span>
            <span className="fundcat-n">{CAT_NOTE[cat]}</span>
          </div>
          <div className="fundlist">
            {es
              .sort((a, b) => (b.amount || 0) - (a.amount || 0))
              .map((e, i) => {
                const native = nativeAmt(e.amount, e.currency)
                const eur = e.amount != null ? toEur(e.amount, e.currency) : null
                return (
                  <div className="fundrow clickable" key={e.company_id + i} onClick={() => open({ type: 'studio', id: e.company_id })} title="View sources">
                    <div className="fundco">
                      <span className="fundco-n">{e.company_name.split('(')[0].trim()} <span className="srccue">ⓘ</span></span>
                      <span className="funddate">{shortDate(e.round_date)}</span>
                    </div>
                    <div className="fundamt">
                      {native ? (
                        <>
                          <b>{native}</b>
                          {e.currency !== 'EUR' && eur != null && <i className="fundeur">≈ €{fmt(eur)}</i>}
                        </>
                      ) : (
                        <span className="finna-sm">undisclosed</span>
                      )}
                    </div>
                    <div className="fundinv">
                      {e.investors || '—'}
                      <span className={'tagpill ' + conf(e.confidence)} style={{ marginLeft: 6 }}>{e.confidence || 'EST'}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      ))}

      <p className="note" style={{ marginTop: 20 }}>
        Euro figures use fixed approximate rates and span many years, so treat them as rough comparison only.
        "Undisclosed" is the honest majority: strategic stakes and publisher advances are almost never public.
      </p>
    </div>
  )
}
