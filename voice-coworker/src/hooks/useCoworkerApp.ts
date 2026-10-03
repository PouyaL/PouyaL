import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AiMsg, Coworker, Doc, DocTab, Matches, Mode, Msg, View } from '../types'
import { byId, docs as baseDocs } from '../data/docs'
import { CODE_INTRO, CODE_KEYS, CODE_LINES, SCRIPTS, planFor } from '../data/scripts'
import { nowTime, prefersReducedMotion, wait } from '../lib/format'
import { say, stopSpeech } from '../lib/speech'

export interface Highlight { anchor: string; tag: string }
export interface DialogSpec {
  title: string
  body: string
  ok: string
  danger?: boolean
  scrim?: boolean
  onOk: () => void
  onCancel?: () => void
}
export interface ToastSpec { id: number; text: string; action?: string; onAction?: () => void }

const INITIAL_COWORKERS: Coworker[] = [
  { id: 'cls', name: 'Classification', group: 'Today', docs: 128, chats: 3 },
  { id: 'da', name: 'Doc analysis', group: 'Last 7 days', docs: 46, chats: 12 },
  { id: 'cd', name: 'Classify dec', group: 'Last 7 days', docs: 9, chats: 3 },
  { id: 'ed', name: 'Extract doc', group: 'Last 7 days', docs: 312, chats: 144 },
  { id: 'sm', name: 'Summarizer', group: 'Last 7 days', docs: 27, chats: 41 },
  { id: 'mc', name: 'Markdown converter', group: 'Last 30 days', docs: 5, chats: 27 },
]

const isPhone = () => window.innerWidth <= 860
const reduce = prefersReducedMotion()

export function useCoworkerApp() {
  const [coworkers, setCoworkers] = useState(INITIAL_COWORKERS)
  const [active, setActive] = useState<string | null>('cls')
  const [side, setSide] = useState(false)
  const [view, setView] = useState<View>('chat')
  const [docTab, setDocTab] = useState<DocTab>('lib')
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const [matches, setMatches] = useState<Matches | null>(null)
  const [filter, setFilter] = useState('')
  const [mode, setModeState] = useState<Mode>('idle')
  const [micGranted, setMicGranted] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [draftFromVoice, setDraftFromVoice] = useState(false)
  const [live, setLive] = useState({ c: '', i: '' })
  const [talking, setTalking] = useState(false)
  const [recStart, setRecStart] = useState(0)
  const [uploads, setUploads] = useState<Doc[]>([])
  const [dialog, setDialog] = useState<DialogSpec | null>(null)
  const [toast, setToast] = useState<ToastSpec | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Mirrors for async flows, which must read the latest values after awaits.
  const runId = useRef(0)
  const used = useRef(new Set<number>())
  const words = useRef<string[]>([])
  const R = useRef({ mode, msgs, draft, draftFromVoice, active, side, sessionStarted, micGranted, uploads })
  R.current = { mode, msgs, draft, draftFromVoice, active, side, sessionStarted, micGranted, uploads }

  const allDocs = useMemo(() => [...baseDocs, ...uploads], [uploads])
  const openDoc = openDocId ? allDocs.find((d) => d.id === openDocId) ?? null : null

  const setMode = useCallback((m: Mode) => { R.current.mode = m; setModeState(m) }, [])
  const push = useCallback((m: Msg) => { R.current.msgs = [...R.current.msgs, m]; setMsgs(R.current.msgs) }, [])
  const patchLastAi = useCallback((fn: (m: AiMsg) => Partial<AiMsg>) => {
    const list = R.current.msgs
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i]
      if (m.k === 'ai') {
        R.current.msgs = list.map((x, j) => (j === i ? { ...(x as AiMsg), ...fn(m) } : x))
        setMsgs(R.current.msgs)
        return
      }
    }
  }, [])
  const patchAt = useCallback((i: number, patch: Partial<AiMsg>) => {
    R.current.msgs = R.current.msgs.map((x, j) => (j === i && x.k === 'ai' ? { ...x, ...patch } : x))
    setMsgs(R.current.msgs)
  }, [])

  const showToast = useCallback((text: string, action?: string, onAction?: () => void) => {
    setToast({ id: Date.now(), text, action, onAction })
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.action ? 5000 : 2400)
    return () => clearTimeout(t)
  }, [toast])

  /* ---------- documents ---------- */
  const openDocument = useCallback((id: string, cite: Highlight | null) => {
    setOpenDocId(id); setHighlight(cite); setSide(true); setDocTab('view')
  }, [])

  const ingest = useCallback((files: FileList | File[] | null) => {
    if (!files || !files.length || R.current.active !== 'cls') return
    const added: Doc[] = [...files].map((f) => ({
      id: 'up-' + Math.random().toString(36).slice(2, 8), vendor: 'upload', type: 'Upload', number: '', name: f.name,
      issued: new Date().toISOString().slice(0, 10), pages: 1, indexing: 0, uploaded: true, size: f.size, status: 'Uploaded',
    }))
    setUploads((u) => [...u, ...added])
    added.forEach((d) => {
      const step = () => {
        let again = true
        setUploads((u) => u.map((x) => {
          if (x.id !== d.id || x.indexing == null) return x
          const next = Math.min(100, x.indexing + 8 + Math.random() * 18)
          again = next < 100
          return next >= 100 ? { ...x, indexing: undefined } : { ...x, indexing: next }
        }))
        setTimeout(() => again && step(), 180)
      }
      setTimeout(step, 200)
    })
    setFilter(''); setMatches(null); setSide(true); setDocTab('lib'); setView('docs')
  }, [])

  /* ---------- run control ---------- */
  const stopAll = useCallback((fromUser?: boolean) => {
    runId.current++
    stopSpeech(); setTalking(false)
    const last = [...R.current.msgs].reverse().find((x): x is AiMsg => x.k === 'ai' && !x.done)
    if (last) {
      if (last.kind === 'code') {
        patchLastAi((m) => ({ thinking: false, text: m.text || 'Stopped.', done: true })); setMode('idle')
      } else if (last.answerStarted) {
        patchLastAi(() => ({ done: true, active: -1, thinking: false, srcOpen: true })); setMode('idle')
      } else {
        patchLastAi(() => ({
          answerStarted: true, stepsDone: true, thinking: false, noActions: true, done: true, active: -1,
          sentences: [{ t: 'Stopped. Ask again whenever you’re ready.' }], sources: [],
        })); setMode('idle')
      }
      if (fromUser) push({ k: 'notice', text: 'You interrupted' })
    } else if (R.current.mode !== 'idle') setMode('idle')
  }, [patchLastAi, push, setMode])

  const speakAnswer = useCallback(async (index: number, run: number) => {
    const m = R.current.msgs[index] as AiMsg
    patchAt(index, { done: false, active: -1 }); setMode('speaking')
    const sentences = m.sentences ?? []
    for (let j = 0; j < sentences.length; j++) {
      if (run !== runId.current) return
      patchAt(index, { active: j })
      const c = sentences[j].c
      if (c) {
        const n = (m.sources ?? []).findIndex((x) => x.doc === c.doc && x.anchor === c.anchor)
        openDocument(c.doc, { anchor: c.anchor, tag: c.tag || `Source ${n + 1}` })
        if (isPhone()) setView('chat')
      }
      await say(sentences[j].t, () => run !== runId.current)
    }
    if (run !== runId.current) return
    patchAt(index, { done: true, active: -1, thinking: false, srcOpen: true }); setMode('idle')
  }, [openDocument, patchAt, setMode])

  const answerCode = useCallback(async (run: number) => {
    push({ k: 'ai', kind: 'code', time: nowTime(), thinking: true, text: '', lines: 0, done: false })
    const index = R.current.msgs.length - 1
    setMode('thinking')
    await wait(reduce ? 200 : 2200); if (run !== runId.current) return
    patchAt(index, { thinking: false })
    const w = CODE_INTRO.split(' ')
    for (let i = 1; i <= w.length; i++) {
      if (run !== runId.current) return
      patchAt(index, { text: w.slice(0, i).join(' ') }); await wait(reduce ? 0 : 28)
    }
    for (let i = 1; i <= CODE_LINES.length; i++) {
      if (run !== runId.current) return
      patchAt(index, { lines: i }); await wait(reduce ? 0 : 45)
    }
    patchAt(index, { done: true }); setMode('idle')
  }, [patchAt, push, setMode])

  const selectCoworker = useCallback((id: string) => {
    stopAll()
    runId.current++
    R.current.msgs = []; R.current.active = id; R.current.sessionStarted = false; R.current.draft = ''
    setActive(id); setMsgs([]); setMatches(null); setOpenDocId(null); setDocTab('lib')
    setSessionStarted(false); setDraft(''); setDrawerOpen(false); setMode('idle')
  }, [setMode, stopAll])

  const send = useCallback(async (override?: string) => {
    const text = (override ?? R.current.draft).trim()
    if (!text) return
    if (R.current.active !== 'cls') selectCoworker('cls')
    stopSpeech(); const run = ++runId.current
    const isCode = CODE_KEYS.test(text) && !SCRIPTS.some((s) => s.keys.test(text))
    if (!isCode && !R.current.side) { setSide(true); setDocTab('lib') }
    if ((R.current.side || !isCode) && !R.current.msgs.length) push({ k: 'sep', text: 'Today' })
    push({ k: 'user', text, time: nowTime(), voice: R.current.draftFromVoice })
    setDraft(''); R.current.draft = ''; setDraftFromVoice(false)
    if (isCode) return answerCode(run)
    const si = SCRIPTS.findIndex((s) => s.keys.test(text)); if (si >= 0) used.current.add(si)
    setMatches(null); setDocTab('lib')
    const plan = planFor(text, R.current.uploads)
    push({ k: 'ai', kind: 'doc', time: nowTime(), stepN: 0, answerStarted: false, active: -1, done: false, ...plan })
    const index = R.current.msgs.length - 1
    setMode('thinking')
    for (let i = 1; i <= plan.steps.length; i++) {
      await wait(reduce ? 120 : 620); if (run !== runId.current) return
      patchAt(index, { stepN: i })
      if (i === Math.min(2, plan.steps.length) && plan.matches) { setMatches(plan.matches); setFilter(''); setDocTab('lib') }
    }
    patchAt(index, { stepsDone: true, thinking: true }); await wait(reduce ? 100 : 700); if (run !== runId.current) return
    patchAt(index, { thinking: false, answerStarted: true })
    await speakAnswer(index, run)
  }, [answerCode, patchAt, push, selectCoworker, setMode, speakAnswer])

  /* ---------- voice ---------- */
  const stopRecording = useCallback(async () => {
    const run = ++runId.current; setTalking(false)
    const w = words.current
    if (w.length < 3) {
      setMode('idle'); push({ k: 'notice', err: true, text: 'Didn’t catch that. Try again, or type your question.' }); return
    }
    setLive({ c: w.slice(0, -3).join(' '), i: w.slice(-3).join(' ') }); setMode('transcribing')
    await wait(reduce ? 200 : 1100); if (run !== runId.current) return
    let text = w.join(' '); if (!/[.?!]$/.test(text)) text += '…'
    R.current.draft = text; setDraft(text); setDraftFromVoice(true); R.current.draftFromVoice = true; setMode('idle')
  }, [push, setMode])

  const startRecording = useCallback(async () => {
    stopSpeech(); const run = ++runId.current
    let si = SCRIPTS.findIndex((_, i) => !used.current.has(i))
    if (si < 0) { used.current = new Set(); si = 0 }
    const script = SCRIPTS[si]
    if (!R.current.msgs.length) push({ k: 'sep', text: 'Today' })
    if (!R.current.sessionStarted) { R.current.sessionStarted = true; setSessionStarted(true); push({ k: 'sep', dot: true, text: 'Voice chat started · ' + nowTime() }) }
    setLive({ c: '', i: '' }); setRecStart(Date.now()); words.current = []; setMode('recording'); setView('chat')
    await wait(650)
    for (const w of script.voice.split(' ')) {
      if (run !== runId.current || R.current.mode !== 'recording') return
      words.current.push(w); setTalking(true)
      setLive({ c: words.current.slice(0, -2).join(' '), i: words.current.slice(-2).join(' ') })
      await wait(reduce ? 80 : 170 + Math.random() * 190 + (/[,.?]$/.test(w) ? 260 : 0))
    }
    setTalking(false); await wait(900)
    if (run === runId.current && R.current.mode === 'recording') stopRecording()
  }, [push, setMode, stopRecording])

  const micTap = useCallback(() => {
    if (R.current.active !== 'cls') selectCoworker('cls')
    if (!R.current.side) { setSide(true); setDocTab('lib') }
    if (!R.current.micGranted) {
      setMode('muted')
      setDialog({
        title: 'Mic access required', body: 'To use the voice mode, you need to enable your mic and try again.', ok: 'Try again',
        onOk: () => { R.current.micGranted = true; setMicGranted(true); startRecording() },
        onCancel: () => setMode('idle'),
      })
      return
    }
    startRecording()
  }, [selectCoworker, setMode, startRecording])

  /* ---------- coworkers ---------- */
  const afterRemove = useCallback((id: string, rest: Coworker[]) => {
    if (R.current.active === id) {
      if (rest[0]) selectCoworker(rest[0].id)
      else { setActive(null); R.current.active = null; setMsgs([]); R.current.msgs = [] }
    }
  }, [selectCoworker])

  const archiveCoworker = useCallback((id: string) => {
    const idx = coworkers.findIndex((c) => c.id === id); if (idx < 0) return
    const c = coworkers[idx]; const rest = coworkers.filter((x) => x.id !== id)
    setCoworkers(rest); afterRemove(id, rest)
    showToast('Archived', 'Undo', () => setCoworkers((cur) => { const n = [...cur]; n.splice(idx, 0, c); return n }))
  }, [afterRemove, coworkers, showToast])

  const deleteCoworker = useCallback((id: string) => {
    const c = coworkers.find((x) => x.id === id); if (!c) return
    setDialog({
      title: `Delete “${c.name}”?`, body: `This coworker and its ${c.chats} chats will be permanently deleted. This can’t be undone.`,
      ok: 'Delete', danger: true, scrim: true,
      onOk: () => { const rest = coworkers.filter((x) => x.id !== id); setCoworkers(rest); afterRemove(id, rest) },
    })
  }, [afterRemove, coworkers])

  const newCoworker = useCallback(() => {
    const n: Coworker = { id: 'n' + Date.now(), name: 'Untitled coworker', group: 'Today', docs: 0, chats: 0 }
    setCoworkers((c) => [n, ...c]); selectCoworker(n.id)
  }, [selectCoworker])

  const toggleLibrary = useCallback(() => {
    setSide((s) => !s); if (R.current.side) setView('chat')
  }, [])

  const search = useCallback((q: string) => {
    setFilter(q); setMatches(null); setSide(true); setDocTab('lib'); setView('docs')
  }, [])

  const resetDemo = useCallback(() => {
    stopAll(); R.current.msgs = []; setMsgs([]); setSide(false); setMatches(null); setOpenDocId(null)
    used.current = new Set(); R.current.micGranted = false; setMicGranted(false)
    setSessionStarted(false); R.current.sessionStarted = false; setDraft(''); R.current.draft = ''
  }, [stopAll])

  const setDraftText = useCallback((t: string) => { R.current.draft = t; setDraft(t); setDraftFromVoice(false); R.current.draftFromVoice = false }, [])

  const dismissDialog = useCallback((cancelled: boolean) => {
    setDialog((d) => { if (d && cancelled) d.onCancel?.(); return null })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  useEffect(() => () => { runId.current++; stopSpeech() }, [])

  const hasChat = msgs.some((m) => m.k === 'user' || m.k === 'ai')
  return {
    coworkers, active, side, view, docTab, openDoc, highlight, matches, filter, mode, micGranted, msgs, draft, draftFromVoice, live, talking, recStart,
    allDocs, dialog, toast, drawerOpen, hasChat, sessionStarted,
    setView, setDocTab, setDrawerOpen, dismissToast, setMode, setDialog, setMicGranted, showToast,
    selectCoworker, archiveCoworker, deleteCoworker, newCoworker, toggleLibrary, search, resetDemo,
    openDocument, ingest, micTap, stopRecording, send, stopAll, setDraftText, patchAt, dismissDialog,
    byId,
  }
}
export type CoworkerApp = ReturnType<typeof useCoworkerApp>
