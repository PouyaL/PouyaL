import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { DialogSpec, ToastSpec } from '../hooks/useCoworkerApp'
import { Icon } from './Icon'

export interface MenuSpec { x: number; y: number; items: ReactNode; onPick: (act: string) => void }

export function Menu({ spec, onClose }: { spec: MenuSpec; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    el.style.left = Math.min(Math.max(8, spec.x), window.innerWidth - el.offsetWidth - 8) + 'px'
    el.style.top = Math.min(spec.y, window.innerHeight - el.offsetHeight - 8) + 'px'
    el.querySelector('button')?.focus()
    const outside = (e: MouseEvent) => { if (!el.contains(e.target as Node)) onClose() }
    const t = setTimeout(() => document.addEventListener('click', outside, true), 0)
    return () => { clearTimeout(t); document.removeEventListener('click', outside, true) }
  }, [spec, onClose])
  return (
    <div ref={ref} className="menu" role="menu" onClick={(e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]'); if (b) { onClose(); spec.onPick(b.dataset.act!) }
    }}>{spec.items}</div>
  )
}

export function Dialog({ spec, onDismiss }: { spec: DialogSpec; onDismiss: (cancelled: boolean) => void }) {
  const ok = useRef<HTMLButtonElement>(null)
  useEffect(() => ok.current?.focus(), [])
  return (
    <div className={'scrim' + (spec.scrim ? ' dark' : '')} onClick={(e) => { if (e.target === e.currentTarget) onDismiss(true) }}>
      <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlgT">
        <button className="x ibtn" aria-label="Close" style={{ width: 24, height: 24 }} onClick={() => onDismiss(true)}><Icon name="x" /></button>
        <h3 id="dlgT">{spec.title}</h3>
        <p>{spec.body}</p>
        <div className="btns">
          <button className="btn btn-outline" onClick={() => onDismiss(true)}>Cancel</button>
          <button ref={ok} className={'btn ' + (spec.danger ? 'btn-danger' : 'btn-primary')} onClick={() => { onDismiss(false); spec.onOk() }}>{spec.ok}</button>
        </div>
      </div>
    </div>
  )
}

export function Toast({ spec, onClose }: { spec: ToastSpec; onClose: () => void }) {
  return (
    <div className="toast" role="status">
      <span>{spec.text}</span>
      {spec.action && <button onClick={() => { onClose(); spec.onAction?.() }}>{spec.action}</button>}
    </div>
  )
}
