import { useState } from 'react'
import type { CoworkerApp } from '../hooks/useCoworkerApp'
import { Icon, Logo } from './Icon'
import type { IconName } from './Icon'

const RAIL_TOP: [string, IconName, number][] = [['Dashboard', 'laptop', 22], ['Workflows', 'workflow', 22], ['Coworkers', 'audio', 20], ['Models', 'brain', 22]]
const RAIL_BOTTOM: [string, IconName][] = [['Help', 'help'], ['Documentation', 'news']]

export function Rail({ app, onSettings }: { app: CoworkerApp; onSettings: (r: DOMRect) => void }) {
  void app
  return (
    <nav className="rail" aria-label="Main">
      <div className="logo" aria-hidden="true"><Logo /></div>
      <div className="div" />
      <div className="grp">
        {RAIL_TOP.map(([label, icon, size]) => (
          <button key={label} className="rail-btn" aria-label={label} aria-current={label === 'Coworkers' ? 'page' : undefined}>
            <Icon name={icon} size={size} strokeWidth={1.75} />
          </button>
        ))}
      </div>
      <div className="div" />
      <div className="grp">
        {RAIL_BOTTOM.map(([label, icon]) => (
          <button key={label} className="rail-btn" aria-label={label}><Icon name={icon} size={22} strokeWidth={1.75} /></button>
        ))}
      </div>
      <div className="grow" />
      <button className="rail-btn" aria-label="Demo settings" onClick={(e) => onSettings(e.currentTarget.getBoundingClientRect())}>
        <Icon name="settings" size={22} strokeWidth={1.75} />
      </button>
    </nav>
  )
}

export function Header({ app }: { app: CoworkerApp }) {
  const [q, setQ] = useState('')
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button className="ibtn menu-btn" aria-label="Open coworkers" onClick={() => app.setDrawerOpen(!app.drawerOpen)}><Icon name="menu" size={20} /></button>
        <div className="crumb">Coworker</div>
      </div>
      <label className="search">
        <Icon name="search" size={24} strokeWidth={1.5} />
        <input placeholder="Search" aria-label="Search documents" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') app.search(q) }} />
      </label>
      <div className="hright">
        <div className={'tabs mtabs' + (app.side ? ' on' : '')} role="tablist" aria-label="View">
          <button role="tab" aria-selected={app.view === 'chat'} onClick={() => app.setView('chat')}>Chat</button>
          <button role="tab" aria-selected={app.view === 'docs'} onClick={() => app.setView('docs')}>Documents</button>
        </div>
        <Icon name="flag" size={24} strokeWidth={1.5} />
        <div className="avatar48" aria-label="Pouya"><span>PO</span></div>
      </div>
    </header>
  )
}

export function CoworkerList({ app, onMore }: { app: CoworkerApp; onMore: (id: string, r: DOMRect) => void }) {
  let group = ''
  return (
    <aside className={'coworkers' + (app.drawerOpen ? ' open' : '')} aria-label="Coworkers">
      <button className="btn btn-primary" onClick={app.newCoworker}>New coworker</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {app.coworkers.map((c) => {
          const header = c.group !== group ? ((group = c.group), <div key={'g' + c.group} className="glabel">{c.group}</div>) : null
          return (
            <div key={c.id} style={{ display: 'contents' }}>
              {header}
              <div className="cw" role="button" tabIndex={0} aria-current={c.id === app.active} onClick={() => app.selectCoworker(c.id)}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); app.selectCoworker(c.id) } }}>
                <div className="t"><b>{c.name}</b><span className="tnum">{c.docs} documents · {c.chats} {c.chats === 1 ? 'chat' : 'chats'}</span></div>
                <button className="kebab" aria-label={`More options for ${c.name}`} aria-haspopup="menu"
                  onClick={(e) => { e.stopPropagation(); onMore(c.id, e.currentTarget.getBoundingClientRect()) }}>
                  <Icon name="more" size={18} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
