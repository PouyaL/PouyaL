import type { Doc, Matches, Plan } from '../types'
import { long, money } from '../lib/format'
import { byId, docs, V } from './docs'

export interface Script {
  voice: string
  chip: string
  keys: RegExp
  build: () => Plan
}

const must = (id: string): Doc => {
  const d = byId(id)
  if (!d) throw new Error(`Missing demo document ${id}`)
  return d
}
const totalOf = (d: Doc) => d.total ?? 0

function buildOverdue(): Plan {
  const a = must('hel-07979'), b = must('hel-08112'), s = must('hel-stmt-q1')
  const helio = docs.filter((d) => d.vendor === 'helio')
  const hInv = helio.filter((d) => d.type === 'Invoice')
  return {
    steps: [`Searched ${docs.length} documents`, `Found ${helio.length} Helio Support files, ${hInv.length} of them invoices`, '2 invoices are past their due date', 'Added up the amounts owed'],
    matches: { ids: [a.id, b.id, s.id], tags: { [a.id]: ['Overdue', ''], [b.id]: ['Overdue', ''], [s.id]: ['Balance', 'info'] }, label: '3 documents answer your question' },
    sentences: [
      { t: 'Two Helio Support invoices are overdue.' },
      { t: `${a.number} was due on ${long(a.due!)}.`, c: { doc: a.id, anchor: 'due', label: a.number } },
      { t: `${b.number} was due on ${long(b.due!)}.`, c: { doc: b.id, anchor: 'due', label: b.number } },
      { t: `Together you owe ${money(totalOf(a) + totalOf(b))}.`, c: { doc: s.id, anchor: 'balance', label: 'Q1 statement' } },
    ],
    sources: [
      { doc: a.id, anchor: 'due', q: `Due date: ${long(a.due!)}`, p: 1 },
      { doc: b.id, anchor: 'due', q: `Due date: ${long(b.due!)}`, p: 1 },
      { doc: s.id, anchor: 'balance', q: `Outstanding balance ${money(s.balance!)}`, p: 1 },
    ],
  }
}

function buildQ1(): Plan {
  const q1 = docs.filter((d) => d.type === 'Invoice' && d.issued >= '2026-01-01' && d.issued <= '2026-03-31')
  const g: Record<string, { v: string; sum: number; n: number; top: Doc }> = {}
  q1.forEach((d) => {
    const x = (g[d.vendor] ||= { v: d.vendor, sum: 0, n: 0, top: d })
    x.sum += totalOf(d)
    x.n++
    if (totalOf(d) > totalOf(x.top)) x.top = d
  })
  const rows = Object.values(g).sort((a, b) => b.sum - a.sum)
  const all = rows.reduce((s, r) => s + r.sum, 0)
  const [r1, r2, r3] = rows
  const cite = (r: (typeof rows)[number]) => ({ doc: r.top.id, anchor: 'total', label: r.top.number })
  return {
    steps: [`Searched ${docs.length} documents`, `Found ${q1.length} invoices dated January to March 2026`, `Grouped them across ${rows.length} vendors`, 'Ranked the totals'],
    matches: {
      ids: rows.slice(0, 3).map((r) => r.top.id),
      tags: Object.fromEntries(rows.slice(0, 3).map((r, i) => [r.top.id, [`#${i + 1} in Q1`, 'info']])) as Matches['tags'],
      label: 'Largest Q1 invoice from each of the top 3 vendors',
    },
    sentences: [
      { t: `In Q1 2026 you were billed ${money(all)} across ${q1.length} invoices.` },
      { t: `${V[r1.v].name} billed the most: ${money(r1.sum)} over ${r1.n} invoice${r1.n > 1 ? 's' : ''}.`, c: cite(r1) },
      { t: `${V[r2.v].name} came second with ${money(r2.sum)}.`, c: cite(r2) },
      { t: `${V[r3.v].name} was third with ${money(r3.sum)}.`, c: cite(r3) },
    ],
    table: rows.slice(0, 6).map((r) => [V[r.v].name, r.n, money(r.sum)]),
    sources: [r1, r2, r3].map((r) => ({ doc: r.top.id, anchor: 'total', q: `Total due ${money(totalOf(r.top))}`, p: 1 })),
  }
}

function buildNDA(): Plan {
  const n = must('nda-northwind')
  const c = (anchor: string, label: string) => ({ doc: n.id, anchor, label })
  return {
    steps: ['Opened NDA_Northwind_signed.pdf', 'Read all 6 pages', 'Pulled out term, scope and obligations'],
    matches: { ids: [n.id], tags: { [n.id]: ['Summarized', 'info'] }, label: '1 document answers your question' },
    sentences: [
      { t: 'The Northwind NDA is mutual and runs for three years from March 2, 2026.', c: c('term', 'p. 1') },
      { t: 'It covers product roadmaps, pricing and customer data shared by either side.', c: c('scope', 'p. 2') },
      { t: 'Anything already public or developed independently is excluded.', c: c('excl', 'p. 3') },
      { t: 'All materials must be returned or destroyed within 30 days of a written request.', c: c('return', 'p. 4') },
      { t: 'It is governed by the laws of Ontario.', c: c('law', 'p. 6') },
    ],
    sources: [
      { doc: n.id, anchor: 'term', q: 'Term: three (3) years from the Effective Date', p: 1 },
      { doc: n.id, anchor: 'scope', q: 'Confidential Information includes product roadmaps, pricing…', p: 2 },
      { doc: n.id, anchor: 'return', q: '…within thirty (30) days of written request', p: 4 },
      { doc: n.id, anchor: 'law', q: 'governed by the laws of the Province of Ontario', p: 6 },
    ],
  }
}

const STOP = new Set(['the', 'and', 'for', 'what', 'which', 'show', 'find', 'our', 'are', 'with', 'from', 'about', 'me', 'all', 'any'])
function buildSearch(q: string, extra: Doc[]): Plan {
  const pool = [...docs, ...extra]
  const terms = q.toLowerCase().split(/[^a-z0-9-]+/).filter((t) => t.length > 2 && !STOP.has(t))
  const hits = pool
    .filter((d) => terms.some((t) => `${d.name} ${V[d.vendor].name} ${d.type} ${d.number}`.toLowerCase().includes(t)))
    .sort((a, b) => b.issued.localeCompare(a.issued))
  if (!hits.length) {
    return {
      steps: [`Searched ${pool.length} documents`, 'No matching documents found'],
      matches: null,
      sentences: [{ t: `I couldn't find anything about “${q}” in these ${pool.length} documents.` }, { t: 'Try asking about overdue invoices, Q1 spending by vendor, or the Northwind NDA.' }],
      sources: [],
    }
  }
  const top = hits[0]
  const plural = hits.length > 1 ? 's' : ''
  return {
    steps: [`Searched ${pool.length} documents`, `Found ${hits.length} matching document${plural}`, 'Checked the most recent one'],
    matches: { ids: hits.slice(0, 12).map((d) => d.id), tags: { [top.id]: ['Most recent', 'info'] }, label: `${hits.length} documents match` },
    sentences: [
      { t: `I found ${hits.length} document${plural} that match “${q}”.` },
      { t: `The most recent is ${top.name}, dated ${long(top.issued)}.`, c: { doc: top.id, anchor: 'number', label: top.number || 'p. 1' } },
    ],
    sources: hits.slice(0, 3).map((d) => ({ doc: d.id, anchor: 'number', q: `${d.type} ${d.number} · ${long(d.issued)}`, p: 1 })),
  }
}

export const SCRIPTS: Script[] = [
  { voice: 'Which Helio Support invoices are overdue, and how much do we owe in total?', chip: 'Which invoices are overdue?', keys: /overdue|owe|unpaid|late|past due|outstanding/i, build: buildOverdue },
  { voice: 'Compare our Q1 totals by vendor.', chip: 'Compare Q1 totals by vendor', keys: /q1|quarter|compare|by vendor|spend|totals?/i, build: buildQ1 },
  { voice: 'Summarize the Northwind NDA for me.', chip: 'Summarize the Northwind NDA', keys: /nda|northwind|confidential|non.?disclosure/i, build: buildNDA },
]

export const planFor = (text: string, uploads: Doc[]): Plan => {
  const s = SCRIPTS.find((x) => x.keys.test(text))
  return s ? s.build() : buildSearch(text.trim(), uploads)
}

export const CODE_KEYS = /code|snippet|python|pydantic|schema|classes|class /i
export const CODE_INTRO =
  'Here’s a starting point in Python with Pydantic. It defines the document classes (for classification) plus a schema per class (for extraction), which is the usual setup for document AI pipelines.'

type Tok = string | [cls: string, text: string]
const k = (t: string): Tok => ['k', t]
const s = (t: string): Tok => ['s', t]
const c = (t: string): Tok => ['c', t]
const n = (t: string): Tok => ['n', t]
const y = (t: string): Tok => ['y', t]
const o = (t: string): Tok => ['o', t]
export const CODE_LINES: Tok[][] = [
  [k('from'), ' enum ', k('import'), ' Enum'],
  [k('from'), ' datetime ', k('import'), ' date'],
  [k('from'), ' typing ', k('import'), ' Optional'],
  [k('from'), ' pydantic ', k('import'), ' BaseModel, Field'],
  [],
  [c('# 1. Document classes (classification labels)')],
  [k('class'), ' ', y('DocumentClass'), '(', o('str'), ', ', y('Enum'), '):'],
  ['    INVOICE = ', s('"invoice"')],
  ['    RECEIPT = ', s('"receipt"')],
  ['    PURCHASE_ORDER = ', s('"purchase_order"')],
  ['    CONTRACT = ', s('"contract"')],
  ['    ID_DOCUMENT = ', s('"id_document"')],
  ['    OTHER = ', s('"other"')],
  [],
  [c('# 2. Shared building blocks')],
  [k('class'), ' ', y('ExtractedField'), '(', y('BaseModel'), '):'],
  ['    value: Optional[', o('str'), '] = ', n('None')],
  ['    confidence: ', o('float'), ' = Field(ge=', n('0.0'), ', le=', n('1.0'), ', default=', n('0.0'), ')'],
  ['    page: Optional[', o('int'), '] = ', n('None')],
  ['    bbox: Optional[list[', o('float'), ']] = ', n('None')],
  [],
  [c('# 3. One schema per class')],
  [k('class'), ' ', y('InvoiceFields'), '(', y('BaseModel'), '):'],
  ['    invoice_number: ExtractedField'],
  ['    vendor_name: ExtractedField'],
  ['    issue_date: Optional[date] = ', n('None')],
  ['    due_date: Optional[date] = ', n('None')],
  ['    total_amount: ExtractedField'],
  ['    currency: ExtractedField'],
]
export const CODE_TEXT = CODE_LINES.map((l) => l.map((t) => (typeof t === 'string' ? t : t[1])).join('')).join('\n')
