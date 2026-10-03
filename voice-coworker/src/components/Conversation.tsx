import { Fragment, useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { AiMsg, Msg } from '../types'
import type { CoworkerApp } from '../hooks/useCoworkerApp'
import { byId } from '../data/docs'
import { CODE_LINES, CODE_TEXT } from '../data/scripts'
import { Icon } from './Icon'

function CodeBlock({ lines, onCopy }: { lines?: number; onCopy: () => void }) {
  const shown = CODE_LINES.slice(0, lines ?? CODE_LINES.length)
  return (
    <div className="codeblk">
      <div className="codebar"><span>Python</span><button onClick={onCopy}><Icon name="clipboard" size={20} strokeWidth={1.5} />Copy</button></div>
      <div className="codebody">
        <pre>{shown.length ? shown.map((line, i) => (
          <Fragment key={i}>{line.map((t, j) => (typeof t === 'string' ? t : <span key={j} className={t[0]}>{t[1]}</span>))}{i < shown.length - 1 ? '\n' : ''}</Fragment>
        )) : ' '}</pre>
      </div>
    </div>
  )
}

interface Ctx {
  app: CoworkerApp
  copy: (t: string) => void
}

function Actions({ i, m, ctx, flush }: { i: number; m: AiMsg; ctx: Ctx; flush?: boolean }) {
  const { app } = ctx
  const retry = () => {
    if (app.mode !== 'idle') return
    const u = [...app.msgs.slice(0, i)].reverse().find((x) => x.k === 'user')
    if (u && u.k === 'user') app.send(u.text)
  }
  const copyText = () => ctx.copy(m.kind === 'code' ? (m.text ?? '') + '\n\n' + CODE_TEXT : (m.sentences ?? []).map((s) => s.t).join(' '))
  return (
    <div className="mactions" style={flush ? { padding: 0, marginLeft: -6 } : undefined}>
      <button className="ibtn" aria-label="Copy" onClick={copyText}><Icon name="copy" /></button>
      <button className="ibtn" aria-label="Retry" onClick={retry}><Icon name="refresh" /></button>
      <button className="ibtn" aria-pressed={!!m.liked} aria-label="Good answer" onClick={() => app.patchAt(i, { liked: !m.liked })}><Icon name="thumb" /></button>
    </div>
  )
}

function WideMsg({ m, i, ctx }: { m: Msg; i: number; ctx: Ctx }): ReactNode {
  if (m.k === 'notice') return <div className={'notice' + (m.err ? ' err' : '')}>{m.text}</div>
  if (m.k === 'user') return (
    <div className="mrow"><div className="av">PO</div><div className="mcontent"><div className="mtime">{m.time}</div><div className="mbubble">{m.text}</div></div></div>
  )
  if (m.k !== 'ai') return null
  if (m.thinking || (!m.text && !m.answerStarted && m.kind === 'code')) {
    return <div className="reason"><span className="lbl">Thinking...</span><Icon name="chev-r" size={14} strokeWidth={1.5} /></div>
  }
  const body = m.kind === 'code' ? m.text : (m.sentences ?? []).map((s) => s.t).join(' ')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="mrow ai"><div className="mcontent"><div className="mtime">{m.time}</div><div className="mbubble">{body}</div></div><div className="av">AI</div></div>
      {m.kind === 'code' && !!m.lines && <CodeBlock lines={m.lines} onCopy={() => ctx.copy(CODE_TEXT)} />}
      {m.done && !m.noActions && <Actions i={i} m={m} ctx={ctx} />}
    </div>
  )
}

function SideMsg({ m, i, ctx }: { m: Msg; i: number; ctx: Ctx }): ReactNode {
  const { app } = ctx
  if (m.k === 'sep') return <div className="sep">{m.dot ? <span><i />{m.text}</span> : m.text}</div>
  if (m.k === 'notice') return <div className={'notice' + (m.err ? ' err' : '')}>{m.text}</div>
  if (m.k === 'user') return <div className="su">{m.text}</div>

  if (m.kind === 'code') {
    if (m.thinking) return <div className="shim">Thinking…</div>
    return (
      <div className="sa">
        <div>{m.text}</div>
        {!!m.lines && <CodeBlock lines={m.lines} onCopy={() => ctx.copy(CODE_TEXT)} />}
        {m.done && <Actions i={i} m={m} ctx={ctx} flush />}
      </div>
    )
  }

  const shown = (m.steps ?? []).slice(0, m.stepN ?? 0)
  const openSource = (doc: string, anchor: string, tag: string) => { app.openDocument(doc, { anchor, tag }); app.setView('docs') }
  return (
    <div className="sa">
      {m.steps && (
        <div className="task">
          <div className="tt">{m.answerStarted ? 'Worked through your documents' : 'Working through your documents'}</div>
          {shown.map((s, j) => {
            const now = !m.stepsDone && j === shown.length - 1
            return <div key={j} className={'step' + (now ? ' now' : '')}>{now ? <span className="spin"><Icon name="loader" size={14} /></span> : <Icon name="check" size={14} />}<span>{s}</span></div>
          })}
        </div>
      )}
      {m.thinking && <div className="shim">Thinking…</div>}
      {m.answerStarted && m.sentences && (
        <>
          <div className="ans">
            {m.sentences.map((s, j) => {
              const st = m.done ? '' : j < (m.active ?? -1) ? 'past' : j === m.active ? 'active' : 'future'
              const n = s.c ? (m.sources ?? []).findIndex((x) => x.doc === s.c!.doc && x.anchor === s.c!.anchor) : -1
              return (
                <div key={j} className={'sent ' + st}>
                  {s.t}
                  {s.c && (
                    <button className={'cite' + ((!m.done && j === m.active) || m.citeOn === j ? ' on' : '')} aria-label={`Open source ${s.c.label}`}
                      onClick={() => { app.patchAt(i, { citeOn: j }); openSource(s.c!.doc, s.c!.anchor, s.c!.tag || `Source ${n + 1}`) }}>
                      <Icon name="file" size={12} />{s.c.label}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {m.table && m.done && (
            <div style={{ overflowX: 'auto' }}>
              <table className="atable">
                <thead><tr><th>Vendor</th><th className="n">Invoices</th><th className="n">Q1 total</th></tr></thead>
                <tbody>{m.table.map((r, j) => <tr key={j}><td>{r[0]}</td><td className="n">{r[1]}</td><td className="n">{r[2]}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {m.done && !!m.sources?.length && (
            <>
              <div className="srch" role="button" tabIndex={0} aria-expanded={!!m.srcOpen} onClick={() => app.patchAt(i, { srcOpen: !m.srcOpen })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.patchAt(i, { srcOpen: !m.srcOpen }) } }}>
                Used {m.sources.length} source{m.sources.length > 1 ? 's' : ''}
                <span style={{ transform: `rotate(${m.srcOpen ? 180 : 0}deg)` }}><Icon name="chev-d" size={12} /></span>
              </div>
              {m.srcOpen && m.sources.map((s, j) => (
                <button key={j} className={'src' + (m.srcOn === j ? ' on' : '')} onClick={() => { app.patchAt(i, { srcOn: j }); openSource(s.doc, s.anchor, `Source ${j + 1}`) }}>
                  <span className="num">{j + 1}</span>
                  <span className="t"><b>{byId(s.doc)?.name}</b><q>{s.q}</q></span>
                  <span className="p">p. {s.p}</span>
                </button>
              ))}
            </>
          )}
          {m.done && !m.noActions && <Actions i={i} m={m} ctx={ctx} flush />}
        </>
      )}
    </div>
  )
}

export function Conversation({ app, wide }: { app: CoworkerApp; wide: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const ctx: Ctx = {
    app,
    copy: (t) => {
      navigator.clipboard?.writeText(t).then(() => app.showToast('Copied'), () => app.showToast('Copy is blocked here. Select the text instead.'))
        ?? app.showToast('Copy is blocked here. Select the text instead.')
    },
  }
  // Follow new content unless the reader has scrolled up.
  useLayoutEffect(() => {
    const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [app.msgs])
  const onScroll = () => { const el = box.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140 }

  const items = app.msgs.map((m, i) => <Fragment key={i}>{wide ? <WideMsg m={m} i={i} ctx={ctx} /> : <SideMsg m={m} i={i} ctx={ctx} />}</Fragment>)
  return (
    <div ref={box} className={wide ? 'wscroll' : 'convo'} onScroll={onScroll}>
      {wide ? <div className="wcol">{items}</div> : items}
    </div>
  )
}
