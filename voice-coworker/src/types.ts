export type DocType = 'Invoice' | 'Receipt' | 'Statement' | 'NDA' | 'Contract' | 'Upload'
export type Line = [desc: string, qty: number, unit: number, amount: number]

export interface Vendor {
  id: string
  name: string
  count: number
  color: string
  what: string
  initials: string
}

export interface Doc {
  id: string
  vendor: string
  type: DocType
  number: string
  name: string
  pages: number
  issued: string
  due?: string | null
  status: string
  lines?: Line[]
  total?: number
  balance?: number
  uploaded?: boolean
  size?: number
  indexing?: number
}

export interface Cite {
  doc: string
  anchor: string
  label: string
  tag?: string
}
export interface Sentence {
  t: string
  c?: Cite
}
export interface Source {
  doc: string
  anchor: string
  q: string
  p: number
}
export interface Matches {
  ids: string[]
  tags: Record<string, [label: string, tone: '' | 'info']>
  label: string
}
export interface Plan {
  steps: string[]
  matches: Matches | null
  sentences: Sentence[]
  sources: Source[]
  table?: [string, number, string][]
}

export interface Coworker {
  id: string
  name: string
  group: string
  docs: number
  chats: number
}

export type Mode = 'idle' | 'muted' | 'recording' | 'transcribing' | 'thinking' | 'speaking'
export type View = 'chat' | 'docs'
export type DocTab = 'lib' | 'view'

export interface SepMsg { k: 'sep'; text: string; dot?: boolean }
export interface NoticeMsg { k: 'notice'; text: string; err?: boolean }
export interface UserMsg { k: 'user'; text: string; time: string; voice?: boolean }
export interface AiMsg extends Partial<Plan> {
  k: 'ai'
  kind: 'doc' | 'code'
  time: string
  stepN?: number
  stepsDone?: boolean
  answerStarted?: boolean
  active?: number
  done?: boolean
  thinking?: boolean
  text?: string
  lines?: number
  srcOpen?: boolean
  srcOn?: number
  citeOn?: number
  liked?: boolean
  noActions?: boolean
}
export type Msg = SepMsg | NoticeMsg | UserMsg | AiMsg
