const D = (s: string) => new Date(s + 'T12:00:00')
export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (s: string, n: number) => {
  const d = D(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}
export const money = (n: number) =>
  'EUR ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const short = (s: string) => D(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
export const long = (s: string) =>
  D(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
export const month = (s: string) => D(s).toLocaleDateString('en-US', { month: 'long' })
export const nowTime = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
