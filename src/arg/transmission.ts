import type { Transmission } from './content'
import { element, paragraphs, hints, continuation } from './ui'

export function renderTransmission(room: HTMLElement, content: Transmission) {
  const draft = element('section', '', 'draft-console')
  draft.append(element('h2', content.draftLabel))
  const output = element('p', content.drafts[0], 'draft-line')
  output.setAttribute('aria-live', 'polite')
  const counter = element('p', `revision 01 / ${String(content.drafts.length).padStart(2, '0')}`, 'muted')
  const revise = element('button', 'Recover next revision')
  revise.type = 'button'
  let revision = 0
  revise.addEventListener('click', () => {
    revision++
    output.textContent = content.drafts[revision]
    counter.textContent = `revision ${String(revision + 1).padStart(2, '0')} / ${String(content.drafts.length).padStart(2, '0')}`
    if (revision === content.drafts.length - 1) {
      revise.textContent = 'No further saved revision'
      revise.disabled = true
    }
  })
  draft.append(counter, output, revise)
  const transmission = element('div', '', 'transmission-text')
  paragraphs(transmission, content.lines)
  const logs = element('section', '', 'recovered-log')
  logs.append(element('h2', 'Recovered outgoing drafts'), element('p', content.recordNote, 'muted'))
  const list = element('ol', '', 'log-lines')
  content.records.forEach(record => {
    const item = element('li')
    const time = element('span', record.time, 'log-time')
    item.append(time, element('span', record.text, 'log-message'))
    list.append(item)
  })
  logs.append(list)
  const form = element('form', '', 'puzzle-form')
  const label = element('label', content.puzzle.prompt)
  label.htmlFor = 'next-directory'
  const input = element('input')
  input.id = 'next-directory'
  input.name = 'directory'
  input.required = true
  input.maxLength = 80
  input.autocomplete = 'off'
  input.spellcheck = false
  input.setAttribute('autocapitalize', 'none')
  const submit = element('button', 'Recover directory')
  submit.type = 'submit'
  const status = element('p', '', 'status')
  status.id = 'puzzle-status'
  status.setAttribute('role', 'status')
  input.setAttribute('aria-describedby', status.id)
  form.append(label, input, submit, status)
  form.addEventListener('submit', event => {
    event.preventDefault()
    if (input.value.trim().toLowerCase().replace(/^\/+|\/+$/g, '') !== content.puzzle.answer.toLowerCase()) {
      status.textContent = 'No directory recovered. Look at where each outgoing draft begins.'
      return
    }
    submit.disabled = true
    status.textContent = 'Directory recovered. A receipt survived with it.'
    continuation(room, content.puzzle.next)
  })
  room.append(draft, transmission, logs, form)
  hints(room, content.puzzle.hints)
}
