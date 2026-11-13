import './style.css'
import './arg/room.css'
import { unseal } from './arg/crypto.mjs'
import type { ChapterContent } from './arg/content'
import { element, paragraphs } from './arg/ui'
import { renderTransmission } from './arg/transmission'
import { fetchCapsule, renderArchive } from './arg/archive'

const form = document.querySelector<HTMLFormElement>('#unlock-form')!
const phrase = document.querySelector<HTMLInputElement>('#phrase')!
const status = document.querySelector<HTMLElement>('#unlock-status')!
const room = document.querySelector<HTMLElement>('#room')!
const assetId = document.body.dataset.asset!
if (!globalThis.crypto?.subtle) {
  status.textContent = 'This browser cannot open encrypted copies here. Use a recent browser on HTTPS or localhost.'
  form.querySelector('button')!.disabled = true
}
form.addEventListener('submit', async event => {
  event.preventDefault()
  const submit = form.querySelector('button')!
  submit.disabled = true
  status.textContent = 'Opening the preserved copy…'
  let envelope
  try {
    envelope = await fetchCapsule(assetId)
  } catch {
    status.textContent = 'The copy could not be retrieved. Check your connection and try again.'
    submit.disabled = false
    return
  }
  try {
    const secret = phrase.value
    const content = await unseal(envelope, secret, assetId) as ChapterContent
    if (!['transmission', 'archive', 'ending'].includes(content.kind)) throw new Error('Unknown copy')
    document.body.classList.add(`room-${content.kind}`)
    document.title = `${content.title} · preserved copy`
    const title = element('h1', content.title)
    title.id = 'room-title'
    title.tabIndex = -1
    room.replaceChildren(element('p', content.eyebrow, 'eyebrow'), title)
    const intro = element('div', '', 'room-intro')
    paragraphs(intro, content.intro)
    room.append(intro)
    if (content.kind === 'transmission') renderTransmission(room, content)
    if (content.kind === 'archive') renderArchive(room, content, secret)
    if (content.kind === 'ending') {
      const writing = element('div', '', 'ending-writing')
      content.sections.forEach(lines => {
        const section = element('div', '', 'ending-section')
        paragraphs(section, lines)
        writing.append(section)
      })
      const closing = element('p', content.closing, 'ending-closing')
      const unfinished = element('p', content.unfinished, 'unfinished-note')
      room.append(writing, closing, unfinished)
      const returnLink = element('a', 'Back to the page you came from', 'ending-return')
      returnLink.href = '/'
      room.append(returnLink)
    }
    phrase.value = ''
    title.focus()
  } catch {
    status.textContent = 'That phrase did not open this copy. Use the full recovery phrase from the preceding page; the directory name alone will not open it.'
    submit.disabled = false
    phrase.focus()
  }
})
