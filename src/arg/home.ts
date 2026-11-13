import { continuation, hints } from './ui'

export function setupDiscovery() {
  const discovery = document.querySelector<HTMLDetailsElement>('#earlier-copy')
  const form = document.querySelector<HTMLFormElement>('#directory-form')
  const answer = document.querySelector<HTMLInputElement>('#directory')
  const status = document.querySelector<HTMLElement>('#directory-status')
  const whisper = document.querySelector<HTMLButtonElement>('#whisper')
  if (!discovery || !form || !answer || !status || !whisper) return
  whisper.addEventListener('click', () => {
    discovery.open = !discovery.open
    if (discovery.open) {
      whisper.textContent = 'There was another version.'
      answer.focus()
    } else whisper.textContent = "Let's all love Lain."
  })
  discovery.addEventListener('toggle', () => {
    whisper.setAttribute('aria-expanded', String(discovery.open))
    if (!discovery.open) whisper.textContent = "Let's all love Lain."
  })
  hints(discovery, [
    'The alphabet has twenty-six positions. Begin counting at one.',
    '23 is W. 09 is I. Read all five positions, then enter the directory name.',
    'The five letters name an earlier connection. Enter them together; capital letters are fine.',
  ])
  form.addEventListener('submit', async event => {
    event.preventDefault()
    const positions = discovery.dataset.letterPositions!.split(' ').map(Number)
    const directory = positions.map(n => String.fromCharCode(96 + n)).join('')
    if (answer.value.trim().replace(/^\/+|\/+$/g, '').toLowerCase() !== directory) {
      status.textContent = 'That directory does not match the five positions. The alphabet note may help.'
      return
    }
    const button = form.querySelector('button')!
    button.disabled = true
    status.textContent = 'Retrieving the recovery receipt…'
    try {
      const response = await fetch('/connection.json')
      if (!response.ok) throw new Error('Receipt unavailable')
      const { phrase } = await response.json()
      continuation(discovery, { route: directory, secret: phrase, note: 'An earlier copy was kept. Its text needs this receipt.' })
      status.textContent = 'Earlier directory found.'
      whisper.textContent = 'There was another version.'
    } catch {
      status.textContent = 'The receipt could not be retrieved. Try again when the connection returns.'
      button.disabled = false
    }
  })
}
