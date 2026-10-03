import { useEffect, useRef, useState } from 'react'
import type { CoworkerApp } from '../hooks/useCoworkerApp'
import type { Doc } from '../types'
import { V, byId } from '../data/docs'
import { addDays, long, money, short } from '../lib/format'
import { Icon } from './Icon'

/* ---------- library ---------- */
export function Library({ app, onPickFiles }: { app: CoworkerApp; onPickFiles: () => void }) {
  const isCls = app.active === 'cls'
  if (!isCls) {
    return (
      <div className="lib">
        <div className="empty"><b>No documents yet</b><span>Drop documents here, or open Classification to try the demo library.</span>
          <button className="btn btn-outline" onClick={() => { app.selectCoworker('cls'); app.toggleLibrary() }}>Open Classification</button></div>
      </div>
    )
  }
  const f = app.filter.toLowerCase().trim()
  const set = app.matches ? new Set(app.matches.ids) : null
  let list = app.allDocs.slice().sort((a, b) => b.issued.localeCompare(a.issued))
  if (f) list = list.filter((d) => `${d.name} ${V[d.vendor].name} ${d.type}`.toLowerCase().includes(f))
  if (set) list.sort((a, b) => Number(set.has(b.id)) - Number(set.has(a.id)))
  return (
    <div className="lib">
      <label className="drop" tabIndex={0} onClick={(e) => { e.preventDefault(); onPickFiles() }}>
        <Icon name="clip" /><div><b>Drop documents anywhere</b><span>PDF, Word, scans and images. No limit on how many.</span></div>
      </label>
      <div className="lhead">{f ? `Results for “${app.filter}”` : 'All documents'}</div>
      {list.map((d) => {
        const tag = app.matches?.tags[d.id]
        const dim = !!set && !set.has(d.id)
        const indexing = d.indexing != null
        return (
          <div key={d.id} className={'row' + (dim ? ' dim' : '')} role="button" tabIndex={0}
            onClick={() => !indexing && app.openDocument(d.id, null)}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !indexing) { e.preventDefault(); app.openDocument(d.id, null) } }}>
            <span className="fic"><Icon name="file" /></span>
            <div className="t"><b>{d.name}</b>
              {indexing ? <div className="prog"><i style={{ width: `${d.indexing}%` }} /></div>
                : <span>{d.uploaded ? 'Uploaded just now' : `${V[d.vendor].name} · ${d.pages} page${d.pages > 1 ? 's' : ''}`}</span>}
            </div>
            {tag && <span className={'otag ' + tag[1]}><i />{tag[0]}</span>}
            <span className="d tnum">{indexing ? 'Indexing…' : short(d.issued)}</span>
          </div>
        )
      })}
      {!list.length && <p className="disc">No documents match your search.</p>}
    </div>
  )
}

/* ---------- viewer ---------- */
const Foot = ({ d, p }: { d: Doc; p: number }) => <div className="foot"><span>{d.number || d.name}</span><span>Demo document · Page {p} of {d.pages}</span></div>
const Paper = ({ p, children }: { p: number; children: React.ReactNode }) => <article className="paper" data-page={p}>{children}</article>

function Head({ d }: { d: Doc }) {
  const v = V[d.vendor]
  const title = d.type === 'NDA' ? 'MUTUAL NDA' : d.type === 'Contract' ? 'MASTER SERVICES AGREEMENT' : d.type.toUpperCase()
  return (
    <div className="ph">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="vmark" style={{ background: v.color }}>{v.initials}</div>
        <div><b>{v.name} Ltd.</b><div className="addr">{v.what} · 200 Demo Street, Toronto ON</div></div>
      </div>
      <div style={{ textAlign: 'right' }}><h3>{title}</h3><div className="addr">{d.number}</div></div>
    </div>
  )
}
const BillTo = () => <div><div className="addr">Bill to</div><b>Northbeam Labs Inc.</b><div className="addr">Accounts payable · 55 Sample Ave, Montreal QC</div></div>

function Pages({ d }: { d: Doc }) {
  const v = V[d.vendor]
  if (d.uploaded) {
    return <Paper p={1}><h3 data-anchor="number">{d.name}</h3><p className="addr">Uploaded {long(d.issued)} · {((d.size ?? 0) / 1024).toFixed(0)} KB</p>
      <p style={{ color: '#666', marginTop: 20 }}>This demo indexes the file name only. In the real product the full text is read and becomes searchable.</p><Foot d={d} p={1} /></Paper>
  }
  if (d.type === 'Invoice' || d.type === 'Receipt') {
    const total = d.total ?? 0
    return (
      <>
        <Paper p={1}>
          <Head d={d} />
          <div className="grid2"><BillTo />
            <dl className="kv">
              <dt>Invoice number</dt><dd data-anchor="number">{d.number}</dd>
              <dt>Issue date</dt><dd>{long(d.issued)}</dd>
              {d.due ? (
                <>
                  <dt>Payment terms</dt><dd>Net 14</dd>
                  <dt className="clause" data-anchor="due" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', color: 'inherit' }}>
                    <span style={{ color: '#666' }}>Due date</span><span><b>{long(d.due)}</b></span>
                  </dt>
                </>
              ) : (<><dt>Paid on</dt><dd>{long(d.issued)}</dd></>)}
              <dt>Status</dt><dd>{d.type === 'Receipt' ? 'Paid' : d.status}</dd>
            </dl>
          </div>
          <b>Charge summary</b>
          <table><thead><tr><th>Description</th><th className="n">Qty</th><th className="n">Unit (EUR)</th><th className="n">Amount (EUR)</th></tr></thead>
            <tbody>{(d.lines ?? []).map((l, i) => <tr key={i}><td>{l[0]}</td><td className="n">{l[1].toLocaleString('en-US')}</td><td className="n">{l[2].toFixed(2)}</td><td className="n">{l[3].toFixed(2)}</td></tr>)}</tbody></table>
          <div className="totals"><div><span>Subtotal</span><span>{total.toFixed(2)}</span></div><div><span>VAT (reverse charge)</span><span>0.00</span></div>
            <div className="grand clause" data-anchor="total"><span>{d.type === 'Receipt' ? 'Amount paid' : 'Total due'}</span><span>{money(total)}</span></div></div>
          <Foot d={d} p={1} />
        </Paper>
        {Array.from({ length: d.pages - 1 }, (_, k) => k + 2).map((p) => (
          <Paper key={p} p={p}><h4>Usage detail</h4>
            <table><thead><tr><th>Date</th><th>Item</th><th className="n">Amount (EUR)</th></tr></thead>
              <tbody>{[0, 1, 2, 3, 4].map((i) => <tr key={i}><td>{short(addDays(d.issued, i * 6))}</td><td>{v.what} usage</td><td className="n">{(total / (5 * d.pages)).toFixed(2)}</td></tr>)}</tbody></table>
            <Foot d={d} p={p} /></Paper>
        ))}
      </>
    )
  }
  if (d.type === 'Statement') {
    const open = d.id === 'hel-stmt-q1' ? [byId('hel-07979'), byId('hel-08112')].filter((x): x is Doc => !!x) : []
    const bal = d.balance ?? open.reduce((s, x) => s + (x.total ?? 0), 0)
    return (
      <>
        <Paper p={1}><Head d={d} />
          <div className="grid2"><BillTo /><dl className="kv"><dt>Statement</dt><dd data-anchor="number">{d.number}</dd><dt>Date</dt><dd>{long(d.issued)}</dd><dt>Period</dt><dd>Jan 1 to Mar 31, 2026</dd></dl></div>
          <b>Open items</b>
          <table><thead><tr><th>Invoice</th><th>Due</th><th className="n">Amount (EUR)</th></tr></thead>
            <tbody>{open.length ? open.map((x) => <tr key={x.id}><td>{x.number}</td><td>{long(x.due!)}</td><td className="n">{(x.total ?? 0).toFixed(2)}</td></tr>) : <tr><td colSpan={3}>No open items</td></tr>}</tbody></table>
          <div className="totals"><div className="grand clause" data-anchor="balance"><span>Outstanding balance</span><span>{money(bal)}</span></div></div>
          <Foot d={d} p={1} />
        </Paper>
        {d.pages > 1 && <Paper p={2}><h4>Payment details</h4><p>Please quote the statement number with your payment.</p><p className="addr">IBAN DE00 0000 0000 0000 0000 00 (demo)</p><Foot d={d} p={2} /></Paper>}
      </>
    )
  }
  if (d.type === 'NDA') {
    const P = ({ p, children }: { p: number; children: React.ReactNode }) => <Paper p={p}>{p === 1 && <Head d={d} />}{children}<Foot d={d} p={p} /></Paper>
    return (
      <>
        <P p={1}><p>This Mutual Non-Disclosure Agreement is made between <b>Northwind Distribution Inc.</b> and <b>Northbeam Labs Inc.</b> (each a “Party”).</p>
          <h4>1. Term</h4><p className="clause" data-anchor="term">This Agreement takes effect on March 2, 2026 (the “Effective Date”) and remains in force for three (3) years from the Effective Date.</p>
          <h4>2. Purpose</h4><p>The Parties wish to evaluate a distribution partnership and will share information for that purpose only.</p></P>
        <P p={2}><h4>3. Confidential Information</h4><p className="clause" data-anchor="scope">Confidential Information includes product roadmaps, pricing, customer data and any other non-public business information disclosed by either Party, in any form.</p>
          <p>Each Party will protect the other’s Confidential Information with at least reasonable care.</p></P>
        <P p={3}><h4>4. Exclusions</h4><p className="clause" data-anchor="excl">Confidential Information does not include information that is or becomes public through no fault of the receiving Party, or that the receiving Party develops independently.</p></P>
        <P p={4}><h4>5. Return of materials</h4><p className="clause" data-anchor="return">On written request, the receiving Party will return or destroy all Confidential Information within thirty (30) days and confirm this in writing.</p></P>
        <P p={5}><h4>6. No licence</h4><p>Nothing in this Agreement grants any licence or right to the other Party’s intellectual property.</p></P>
        <P p={6}><h4>7. Governing law</h4><p className="clause" data-anchor="law">This Agreement is governed by the laws of the Province of Ontario and the federal laws of Canada that apply there.</p>
          <p style={{ marginTop: 28 }}>Signed for Northwind Distribution Inc. and Northbeam Labs Inc. on March 2, 2026.</p></P>
      </>
    )
  }
  return (
    <>
      <Paper p={1}><Head d={d} /><p data-anchor="number">This Master Services Agreement ({d.number}) between <b>Acme Corp</b> and <b>Northbeam Labs Inc.</b> starts on {long(d.issued)}.</p>
        <h4>1. Services</h4><p>Acme will provide professional services described in statements of work signed under this Agreement.</p>
        <h4>2. Fees</h4><p>Fees are invoiced monthly and due within 30 days.</p><Foot d={d} p={1} /></Paper>
      {Array.from({ length: Math.min(d.pages, 4) - 1 }, (_, k) => k + 2).map((p) => (
        <Paper key={p} p={p}><h4>{p + 1}. Section {p + 1}</h4><p>Standard terms continue in the full document.</p><Foot d={d} p={p} /></Paper>
      ))}
    </>
  )
}

export function Viewer({ app }: { app: CoworkerApp }) {
  const d = app.openDoc
  const canvas = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)
  const { highlight } = app

  // Highlight the cited clause, update the page counter and scroll it into view.
  useEffect(() => {
    const root = canvas.current
    if (!d || !root) return
    root.querySelectorAll('.hl').forEach((e) => e.classList.remove('hl'))
    if (!highlight) { setPage(1); return }
    const el = root.querySelector<HTMLElement>(`[data-anchor="${highlight.anchor}"]`)
    if (!el) return
    el.classList.add('hl'); el.dataset.tag = highlight.tag
    const pg = el.closest<HTMLElement>('.paper')
    setPage(Number(pg?.dataset.page ?? 1))
    const raf = requestAnimationFrame(() => {
      const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - root.clientHeight / 2 + el.offsetHeight / 2
      root.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(raf)
  }, [d, highlight])

  if (!d) return <div className="vwrap"><div className="empty"><Icon name="file" size={22} /><b>No document open</b><span>Pick one from the library, or tap a citation to jump to its source.</span></div></div>
  return (
    <div className="vwrap">
      <div className="vbar">
        <button className="ibtn" aria-label="Back to library" style={{ width: 24, height: 24 }} onClick={() => app.setDocTab('lib')}><Icon name="chev-l" /></button>
        <Icon name="file" /><b>{d.name}</b><span className="pg tnum">Page {page} of {d.pages}</span>
      </div>
      <div className="canvas" ref={canvas}><Pages d={d} /></div>
    </div>
  )
}
