import type { Doc, DocType, Vendor } from '../types'
import { addDays, iso, month } from '../lib/format'

// Seeded PRNG so the demo library is identical on every load.
let seed = 20260403
const rnd = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const VENDOR_ROWS: [string, string, number, string, string][] = [
  ['helio', 'Helio Support', 23, '#1f7a5c', 'Customer support software'],
  ['stratus', 'Stratus Cloud', 17, '#3b5bdb', 'Cloud hosting'],
  ['pinecall', 'Pinecall', 12, '#c2410c', 'Business phone lines'],
  ['ledgerly', 'Ledgerly', 11, '#7c3aed', 'Accounting software'],
  ['acme', 'Acme Corp', 10, '#0f766e', 'Professional services'],
  ['northwind', 'Northwind', 8, '#9f1239', 'Distribution partner'],
  ['orbit', 'Orbit Logistics', 8, '#a16207', 'Freight and shipping'],
  ['brightdesk', 'Brightdesk', 7, '#0369a1', 'Coworking space'],
  ['kestrel', 'Kestrel Print', 7, '#4d7c0f', 'Print and signage'],
  ['maple', 'Maple Office Supply', 6, '#b91c1c', 'Office supplies'],
  ['quillon', 'Quillon Legal', 6, '#334155', 'Legal counsel'],
  ['sable', 'Sable Analytics', 5, '#6d28d9', 'Data platform'],
  ['tandem', 'Tandem Travel', 4, '#be185d', 'Corporate travel'],
  ['verda', 'Verda Energy', 4, '#15803d', 'Electricity'],
]

const initialsOf = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2)

export const V: Record<string, Vendor> = {}
VENDOR_ROWS.forEach(([id, name, count, color, what]) => {
  V[id] = { id, name, count, color, what, initials: initialsOf(name) }
})
V.upload = { id: 'upload', name: 'Uploaded', count: 0, color: '#71717a', what: 'Uploaded file', initials: 'UP' }

const compact = (n: string) => n.replace(/[^A-Za-z]/g, '')

export const docs: Doc[] = []
const add = (d: Partial<Doc> & Pick<Doc, 'id' | 'vendor' | 'type' | 'number' | 'name' | 'issued'>) => {
  docs.push({ status: 'Paid', pages: 1 + Math.floor(rnd() * 3), ...d })
}

// Key documents the scripted questions rely on
add({ id: 'hel-07979', vendor: 'helio', type: 'Invoice', number: 'INV-07979', name: 'HelioSupport_INV-07979.pdf', pages: 3, issued: '2026-01-12', due: '2026-01-26', status: 'Overdue',
  lines: [['Support Suite Professional · 5 agents, Jan 12 to Feb 11', 5, 125, 625], ['Talk usage · 1,201 minutes', 1201, 0.1, 120.1], ['Knowledge base add-on', 1, 80.14, 80.14]] })
add({ id: 'hel-08112', vendor: 'helio', type: 'Invoice', number: 'INV-08112', name: 'HelioSupport_INV-08112.pdf', pages: 2, issued: '2026-02-17', due: '2026-03-03', status: 'Overdue',
  lines: [['Support Suite Professional · 5 agents, Feb 12 to Mar 11', 5, 125, 625]] })
add({ id: 'hel-stmt-q1', vendor: 'helio', type: 'Statement', number: 'STM-2026-Q1', name: 'HelioSupport_Statement_Q1-2026.pdf', pages: 2, issued: '2026-04-02', status: 'Open', balance: 1450.24 })
add({ id: 'nda-northwind', vendor: 'northwind', type: 'NDA', number: 'NDA-0302', name: 'NDA_Northwind_signed.pdf', pages: 6, issued: '2026-03-02', status: 'Signed' })
add({ id: 'msa-acme', vendor: 'acme', type: 'Contract', number: 'MSA-0108', name: 'Contract_MSA_Acme.pdf', pages: 14, issued: '2026-01-08', status: 'Signed' })

// Fillers so every vendor reaches its count
const preset: Record<string, number> = { helio: 3, northwind: 1, acme: 1 }
const plan: Record<string, [DocType, number][]> = { helio: [['Invoice', 7], ['Receipt', 10], ['Statement', 3]] }
const pickDate = () => {
  const start = new Date('2025-10-01T12:00:00').getTime()
  const end = new Date('2026-09-20T12:00:00').getTime()
  return iso(new Date(start + rnd() * (end - start)))
}
const PREFIX: Record<string, string> = { Invoice: 'INV', Receipt: 'RCT', Statement: 'STM' }

let num = 31000
VENDOR_ROWS.forEach(([vid]) => {
  const v = V[vid]
  let have = preset[vid] || 0
  const seq: DocType[] | null = plan[vid] ? plan[vid].flatMap(([t, n]) => Array<DocType>(n).fill(t)) : null
  let i = 0
  while (have < v.count) {
    const type: DocType = seq ? seq[i++] : rnd() < 0.62 ? 'Invoice' : rnd() < 0.6 ? 'Receipt' : 'Statement'
    num += Math.floor(7 + rnd() * 90)
    const issued = pickDate()
    const amount = Math.round((60 + rnd() * rnd() * 5200) * 100) / 100
    const n = `${PREFIX[type]}-${num}`
    add({
      id: `${vid}-${n}`, vendor: vid, type, number: n,
      name: `${compact(v.name)}_${type === 'Invoice' ? '' : type + '_'}${n}.pdf`,
      issued, due: type === 'Invoice' ? addDays(issued, 14) : null,
      lines: [[`${v.what} · ${month(issued)}`, 1, amount, amount]],
    })
    have++
  }
})
docs.forEach((d) => {
  if (d.lines) d.total = Math.round(d.lines.reduce((s, l) => s + l[3], 0) * 100) / 100
})

export const byId = (id: string) => docs.find((d) => d.id === id)
