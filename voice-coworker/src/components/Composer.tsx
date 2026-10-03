import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CoworkerApp } from '../hooks/useCoworkerApp'
import { Icon } from './Icon'

function Meter({ start, talking }: { start: number; talking: boolean }) {
  const bars = useRef<(HTMLElement | null)[]>([])
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    let raf = 0, t = 0
    const tick = () => {
      t++
      bars.current.forEach((b, i) => {
        if (!b) return
        b.style.height = (talking ? 4 + 12 * Math.abs(Math.sin((t + i * 7) / 5)) * (0.5 + Math.random() * 0.5) : 2 + Math.random() * 2) + 'px'
        b.style.opacity = i > 10 ? '.35' : '1'
      })
      setSecs(Math.floor((Date.now() - start) / 1000))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [start, talking])
  return (
    <div className="meter">
      <span className="tnum" aria-label="Recording time">0:{String(secs).padStart(2, '0')}</span>
      <span className="wave">{Array.from({ length: 14 }, (_, i) => <i key={i} ref={(el) => { bars.current[i] = el }} />)}</span>
    </div>
  )
}

export function Composer({ app, onAttach }: { app: CoworkerApp; onAttach: () => void }) {
  const { mode, draft, live } = app
  const rec = mode === 'recording', tr = mode === 'transcribing', busy = mode === 'thinking' || mode === 'speaking'
  const ta = useRef<HTMLTextAreaElement>(null)
  const wasLive = useRef(false)

  useLayoutEffect(() => {
    const t = ta.current; if (!t) return
    t.style.height = 'auto'; t.style.height = Math.min(180, Math.max(64, t.scrollHeight)) + 'px'
  }, [draft, mode])
  // After a voice transcription lands, focus the field with the caret at the end.
  useEffect(() => {
    const live = rec || tr
    if (wasLive.current && !live && ta.current && app.draftFromVoice) { ta.current.focus(); ta.current.setSelectionRange(draft.length, draft.length) }
    wasLive.current = live
  }, [rec, tr, app.draftFromVoice, draft.length])

  return (
    <div className="pi">
      {rec || tr ? (
        <div className="live">{live.c}{live.i && <> <span className="interim">{live.i}</span></>}{rec && <span className="caret" />}</div>
      ) : (
        <textarea ref={ta} rows={1} placeholder="What would you like to know?" aria-label="Message" value={draft}
          onChange={(e) => app.setDraftText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (draft.trim()) app.send() } }} />
      )}
      <div className="pfoot">
        <div className="tools">
          <button className="tbtn" aria-label="Add documents" onClick={onAttach}><Icon name="clip" /></button>
          <button className={'tbtn mic' + (rec ? ' rec' : '')} aria-label={rec ? 'Stop recording' : 'Ask with your voice'} disabled={tr || busy}
            onClick={() => (rec ? app.stopRecording() : app.micTap())}>
            <Icon name={rec ? 'stop' : 'mic'} size={rec ? 14 : 16} />
          </button>
          {rec && <Meter start={app.recStart} talking={app.talking} />}
          {tr && <div className="tstat"><span className="spin"><Icon name="loader" size={14} /></span>Transcribing…</div>}
        </div>
        {busy ? (
          <button className="submit" aria-label="Stop" onClick={() => app.stopAll(true)}><Icon name="stop" /></button>
        ) : (
          <button className="submit" aria-label="Send" disabled={!draft.trim() || rec || tr} onClick={() => app.send()}><Icon name="send" strokeWidth={1.5} /></button>
        )}
      </div>
    </div>
  )
}
