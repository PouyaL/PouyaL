import { useCallback, useEffect, useRef, useState } from 'react'
import { useCoworkerApp } from './hooks/useCoworkerApp'
import { Composer } from './components/Composer'
import { Conversation } from './components/Conversation'
import { Library, Viewer } from './components/Documents'
import { Icon, Logo } from './components/Icon'
import { Dialog, Menu, Toast } from './components/Overlays'
import type { MenuSpec } from './components/Overlays'
import { CoworkerList, Header, Rail } from './components/Shell'
import type { Mode } from './types'

const BADGES: Partial<Record<Mode, { outline?: boolean; icon: React.ReactNode; label: string }>> = {
  muted: { outline: true, icon: <Icon name="micoff" size={12} />, label: 'Muted' },
  recording: { icon: <span className="dot" />, label: 'Listening' },
  transcribing: { icon: <Icon name="captions" size={12} />, label: 'Transcribing' },
  thinking: { icon: <span className="spin"><Icon name="loader" size={12} /></span>, label: 'Thinking' },
  speaking: { icon: <Icon name="audio" size={12} />, label: 'Speaking' },
}
const GREETING = 'Generated content may be inaccurate.'

export default function App() {
  const app = useCoworkerApp()
  const [menu, setMenu] = useState<MenuSpec | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const pickFiles = () => fileInput.current?.click()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenu(null); app.setDrawerOpen(false)
      if (app.dialog) { app.dismissDialog(true) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [app])

  const cwMenu = (id: string, r: DOMRect) => setMenu({
    x: r.left - 2, y: r.bottom + 4,
    items: (<>
      <button data-act="archive"><Icon name="archive" />Archive<span className="kbd">⌘E</span></button><hr />
      <button className="del" data-act="delete"><Icon name="trash" />Delete<span className="kbd">⌘⌫</span></button>
    </>),
    onPick: (a) => (a === 'archive' ? app.archiveCoworker(id) : app.deleteCoworker(id)),
  })
  const settingsMenu = (r: DOMRect) => setMenu({
    x: r.right + 8, y: r.bottom - 110,
    items: (<>
      <div style={{ padding: '8px 8px 4px', fontSize: 12, color: 'var(--fg-muted)' }}>Demo</div>
      <button data-act="reset"><Icon name="refresh" />Reset the demo</button>
      <button data-act="mic"><Icon name="micoff" />{app.micGranted ? 'Block the mic again' : 'Mic is blocked'}</button>
    </>),
    onPick: (a) => { if (a === 'reset') app.resetDemo(); if (a === 'mic') app.setMicGranted(false) },
  })

  const cw = app.coworkers.find((c) => c.id === app.active)
  const badge = BADGES[app.mode]
  const layout = app.side ? 'side' : app.hasChat ? 'wide' : 'empty'
  const disclaimer = <div className="disc-light">{GREETING}</div>

  return (
    <div className="app">
      <Rail app={app} onSettings={settingsMenu} />
      <div className="main">
        <Header app={app} />
        <div className="content">
          <CoworkerList app={app} onMore={cwMenu} />
          <section className="col" aria-label="Coworker">
            <div className="titlebar">
              <div className="name"><span>{cw ? cw.name : 'No coworker'}</span><span style={{ color: '#09090b' }}><Icon name="pencil" /></span></div>
              <button className="libbtn" aria-pressed={app.side} onClick={app.toggleLibrary}>Document Library<Icon name="sidebar" size={24} strokeWidth={1.5} /></button>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {layout === 'empty' && (
                <div className="card"><div className="greet">
                  <h1><Logo />Hey Pouya!</h1>
                  <div className="comp"><Composer app={app} onAttach={pickFiles} /></div>
                  {disclaimer}
                </div></div>
              )}
              {layout === 'wide' && (
                <div className="wide">
                  <div className="card"><Conversation app={app} wide /></div>
                  <Composer app={app} onAttach={pickFiles} />
                  {disclaimer}
                </div>
              )}
              {layout === 'side' && (
                <div className="split" data-view={app.view}>
                  <section className="pane docs" aria-label="Documents"
                    onDragOver={(e) => { e.preventDefault(); document.getElementById('drop')?.classList.add('over') }}
                    onDragLeave={() => document.getElementById('drop')?.classList.remove('over')}
                    onDrop={(e) => { e.preventDefault(); document.getElementById('drop')?.classList.remove('over'); app.ingest(e.dataTransfer.files) }}>
                    <div className="phead">
                      <span className="dbadge tnum">{app.active === 'cls' ? app.allDocs.length : 0} documents</span><span className="sp" />
                      <div className="tabs" role="tablist" aria-label="Documents view">
                        <button role="tab" aria-selected={app.docTab === 'lib'} onClick={() => app.setDocTab('lib')}>Library</button>
                        <button role="tab" aria-selected={app.docTab === 'view'} onClick={() => app.setDocTab('view')}>Viewer</button>
                      </div>
                    </div>
                    {app.docTab === 'lib' ? <Library app={app} onPickFiles={pickFiles} /> : <Viewer app={app} />}
                  </section>
                  <section className="pane chat" aria-label="Chat">
                    <div className="phead"><span className="ttl">Chat</span>
                      <span>{badge && <span className={'vbadge' + (badge.outline ? ' outline' : '')} role="status">{badge.icon}{badge.label}</span>}</span></div>
                    <Conversation app={app} wide={false} />
                    <div className="scomp"><Composer app={app} onAttach={pickFiles} /><div className="disc">Answers cite your documents. {GREETING}</div></div>
                  </section>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => { app.ingest(e.target.files); e.target.value = '' }} />
      {menu && <Menu spec={menu} onClose={closeMenu} />}
      {app.dialog && <Dialog spec={app.dialog} onDismiss={app.dismissDialog} />}
      {app.toast && <Toast key={app.toast.id} spec={app.toast} onClose={app.dismissToast} />}
    </div>
  )
}
