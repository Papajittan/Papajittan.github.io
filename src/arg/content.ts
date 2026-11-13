export interface Continuation {
  route: string
  secret: string
  note: string
}
export interface BaseContent {
  kind: string
  title: string
  eyebrow: string
  intro: string[]
}
export interface Transmission extends BaseContent {
  kind: 'transmission'
  draftLabel: string
  drafts: string[]
  lines: string[]
  records: { time: string; text: string }[]
  recordNote: string
  puzzle: { prompt: string; hints: string[]; answer: string; next: Continuation }
}
export interface RecoveredDocument {
  revision: string
  copied: string
  original: string[]
  saved: string[]
  margin: string
  note: string
}
export interface Archive extends BaseContent {
  kind: 'archive'
  files: { id: string; name: string }[]
  puzzle: { prompt: string; hints: string[]; order: string[]; next: Continuation }
}
export interface Ending extends BaseContent {
  kind: 'ending'
  sections: string[][]
  closing: string
  unfinished: string
}
export type ChapterContent = Transmission | Archive | Ending
