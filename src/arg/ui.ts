import type { Continuation } from './content'

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (text) node.textContent = text
  if (className) node.className = className
  return node
}

export function paragraphs(parent: HTMLElement, lines: string[]) {
  lines.forEach(line => parent.append(element('p', line)))
}

export function hints(parent: HTMLElement, lines: string[]) {
  const details = element('details', '', 'help')
  details.append(element('summary', 'A small hint'), element('p', lines[0]))
  let index = 1
  if (lines.length > 1) {
    const more = element('button', 'A little more')
    more.type = 'button'
    const output = element('div')
    output.setAttribute('aria-live', 'polite')
    more.addEventListener('click', () => {
      output.append(element('p', lines[index++]))
      if (index === lines.length) more.disabled = true
    })
    details.append(output, more)
  }
  parent.append(details)
}

export function continuation(parent: HTMLElement, next: Continuation) {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(next.route)) throw new Error('Invalid destination')
  const receipt = element('section', '', 'receipt')
  const heading = element('h3', 'Recovery receipt')
  heading.tabIndex = -1
  receipt.append(heading, element('p', next.note))
  const label = element('label', 'Recovery phrase for the next page')
  const phrase = element('input')
  phrase.id = 'next-phrase'
  phrase.readOnly = true
  phrase.value = next.secret
  phrase.spellcheck = false
  label.htmlFor = phrase.id
  phrase.addEventListener('focus', () => phrase.select())
  const copy = element('button', 'Copy recovery phrase')
  copy.type = 'button'
  const status = element('p', '', 'status')
  status.setAttribute('role', 'status')
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(next.secret)
      status.textContent = 'Copied. Keep it to open this copy again.'
    } catch {
      phrase.focus()
      phrase.select()
      status.textContent = 'The phrase is selected. Copy it with your keyboard or touch menu.'
    }
  })
  const link = element('a', `Continue to /${next.route}/`, 'continue-link')
  link.href = `/${next.route}/`
  receipt.append(label, phrase, copy, element('p', 'Keep this receipt, then enter its phrase on the next page.', 'muted'), link, status)
  parent.append(receipt)
  heading.focus()
}
