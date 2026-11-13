import { unseal } from './crypto.mjs'
import type { Envelope } from './crypto.mjs'
import type { Archive, RecoveredDocument } from './content'
import { element, paragraphs, hints, continuation } from './ui'

export async function fetchCapsule(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid asset')
  const response = await fetch(`/capsules/${id}.json`)
  if (!response.ok) throw new Error('Copy unavailable')
  return await response.json() as Envelope
}

export function renderArchive(room: HTMLElement, content: Archive, secret: string) {
  const workbench = element('div', '', 'archive-workbench')
  const list = element('nav', '', 'file-list')
  list.setAttribute('aria-label', 'Recovered files')
  const viewer = element('section', '', 'document-viewer')
  viewer.setAttribute('aria-label', 'Document reader')
  viewer.setAttribute('aria-busy', 'false')
  const empty = element('div', '', 'empty-document')
  empty.append(element('span', '[  ]', 'empty-icon'), element('p', 'Choose a recovered file.'), element('p', 'Nothing here was sent.', 'muted'))
  viewer.append(empty)
  const cache = new Map<string, RecoveredDocument>()
  const fileButtons: HTMLButtonElement[] = []
  let opened = 0
  const progress = element('p', `0 / ${content.files.length} copies opened`, 'muted archive-progress')
  content.files.forEach(file => {
    const button = element('button', file.name, 'file-button')
    button.type = 'button'
    button.setAttribute('aria-pressed', 'false')
    fileButtons.push(button)
    list.append(button)
    button.addEventListener('click', async () => {
      const request = ++opened
      fileButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)))
      viewer.setAttribute('aria-busy', 'true')
      const loading = element('p', 'Recovering this file…', 'muted')
      loading.setAttribute('role', 'status')
      viewer.replaceChildren(loading)
      try {
        let doc = cache.get(file.id)
        if (!doc) {
          doc = await unseal(await fetchCapsule(file.id), secret, file.id) as RecoveredDocument
          cache.set(file.id, doc)
        }
        if (request !== opened) return
        progress.textContent = `${cache.size} / ${content.files.length} copies opened`
        renderDocument(viewer, file.name, doc)
      } catch {
        if (request !== opened) return
        const error = element('p', 'This copy could not be recovered. Select the file again to retry.')
        error.setAttribute('role', 'status')
        viewer.replaceChildren(error)
      } finally {
        if (request === opened) viewer.setAttribute('aria-busy', 'false')
      }
    })
  })
  list.append(progress)
  workbench.append(list, viewer)
  room.append(workbench)

  const form = element('form', '', 'puzzle-form reconstruction')
  const fieldset = element('fieldset')
  fieldset.append(element('legend', content.puzzle.prompt))
  const positions = element('div', '', 'reconstruction-grid')
  const selects = content.files.map((_, index) => {
    const label = element('label', `Position ${index + 1}`)
    const select = element('select')
    select.name = `position-${index + 1}`
    select.required = true
    const placeholder = element('option', 'Choose a file')
    placeholder.value = ''
    select.append(placeholder)
    content.files.forEach(file => {
      const option = element('option', file.name)
      option.value = file.id
      select.append(option)
    })
    label.append(select)
    positions.append(label)
    return select
  })
  fieldset.append(positions)
  const addressLabel = element('label', 'Address recovered from the missing margins')
  addressLabel.htmlFor = 'restored-address'
  const address = element('input')
  address.id = 'restored-address'
  address.name = 'address'
  address.required = true
  address.maxLength = 100
  address.autocomplete = 'off'
  address.spellcheck = false
  address.setAttribute('autocapitalize', 'none')
  const addressNote = element('p', 'Join the words in revision order. Spaces, hyphens and surrounding slashes are accepted.', 'muted address-note')
  addressNote.id = 'address-note'
  address.setAttribute('aria-describedby', 'address-note reconstruction-status')
  const submit = element('button', 'Restore the missing address')
  submit.type = 'submit'
  const status = element('p', '', 'status')
  status.id = 'reconstruction-status'
  status.setAttribute('role', 'status')
  fieldset.setAttribute('aria-describedby', status.id)
  form.append(fieldset, addressLabel, address, addressNote, submit, status)
  form.addEventListener('submit', event => {
    event.preventDefault()
    const values = selects.map(select => select.value)
    if (new Set(values).size !== values.length) {
      status.textContent = 'A copy appears twice. Each file belongs in one position.'
      return
    }
    if (!values.every((id, i) => id === content.puzzle.order[i])) {
      status.textContent = 'These copies do not fit that order. The revision counter survives even when a copy date changes.'
      return
    }
    const restored = address.value.trim().toLowerCase().replace(/^\/+|\/+$/g, '').trim().replace(/\s+/g, '-')
    if (restored !== content.puzzle.next.route) {
      status.textContent = 'The files are in order. Compare their earlier revisions and read the missing margin words in that same order.'
      return
    }
    submit.disabled = true
    status.textContent = 'The margins make a sentence again.'
    continuation(room, content.puzzle.next)
  })
  room.append(form)
  hints(room, content.puzzle.hints)
}

function renderDocument(viewer: HTMLElement, name: string, doc: RecoveredDocument) {
  const heading = element('h2', name)
  heading.tabIndex = -1
  const metadata = element('dl', '', 'file-metadata')
  metadata.append(element('dt', 'Revision'), element('dd', doc.revision), element('dt', 'Copied at'), element('dd', doc.copied))
  const paper = element('div', '', 'document-paper')
  paper.append(element('h3', 'Saved copy'))
  paragraphs(paper, doc.saved)
  const compare = element('details', '', 'comparison')
  compare.append(element('summary', 'Compare with earlier revision'))
  const original = element('div', '', 'earlier-revision')
  original.append(element('h3', 'Earlier revision'))
  paragraphs(original, doc.original)
  original.append(element('p', `Margin: ${doc.margin}`, 'margin-fragment'))
  compare.append(original, element('p', 'Saved margin: [empty]', 'muted'), element('p', doc.note, 'revision-note'))
  viewer.replaceChildren(heading, metadata, paper, compare)
  heading.focus({ preventScroll: true })
  // On narrow screens the reader sits below the file list. Focus must stay visible.
  if (matchMedia('(max-width: 700px)').matches) heading.scrollIntoView({ block: 'nearest' })
}
