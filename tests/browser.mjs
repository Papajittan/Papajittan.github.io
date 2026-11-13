// Private authoring is used only for spoiler-leak assertions, never printed.
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const authorDir = resolve(process.env.ARG_AUTHOR_DIR || '../AboutMe-authoring')
let chapter
try { chapter = JSON.parse(await readFile(resolve(authorDir, 'chapter.json'), 'utf8')) }
catch { throw new Error('Cannot read private chapter.json as JSON. Review it locally; private details withheld.') }
const screenshots = resolve(authorDir, 'verification')
await mkdir(screenshots, { recursive: true, mode: 0o700 })
const base = 'http://127.0.0.1:4173'
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'ignore' })
let browser
const networkTexts = []
const issues = []
try {
  let ready = false
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(base)).ok) { ready = true; break } } catch {}
    await delay(100)
  }
  assert.ok(ready, 'Production preview must start')
  browser = await chromium.launch({ headless: true })
  for (const scenario of [
    { name: 'desktop', viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' },
    { name: 'mobile-reduced', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' },
  ]) {
    const context = await browser.newContext({ viewport: scenario.viewport, reducedMotion: scenario.reducedMotion })
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    page.on('pageerror', () => issues.push('Page exception'))
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) issues.push(`Browser ${message.type()}`) })
    page.on('response', async response => {
      if (response.status() >= 400) issues.push(`HTTP ${response.status()}`)
      if (/\.(?:json|js|css)$/.test(new URL(response.url()).pathname) || response.headers()['content-type']?.includes('text/html')) {
        try { networkTexts.push(await response.text()) } catch {}
      }
    })
    page.on('request', request => {
      assert.ok(request.url().startsWith(base) || request.url().startsWith('data:'), 'No external requests')
      assert.equal(request.method(), 'GET', 'No visitor data is submitted')
    })
    async function screenshot(label) {
      await page.screenshot({ path: resolve(screenshots, `${scenario.name}-${label}.png`), fullPage: true })
    }
    async function checkPage(label, scope = 'body') {
      await page.evaluate(() => document.fonts.ready)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow: ${label}`)
      const results = await new AxeBuilder({ page }).include(scope).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      if (results.violations.length) {
        console.log(JSON.stringify(results.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) }))))
      }
      assert.equal(results.violations.length, 0, `Accessibility violations: ${label}`)
      if (scenario.reducedMotion === 'reduce') {
        assert.ok(await page.evaluate(() => [...document.querySelectorAll('*')].every(el => getComputedStyle(el).animationName === 'none')), 'Reduced motion disables animations')
      }
    }
    async function unlock(secret, expectedKind) {
      await page.getByLabel('Recovery phrase', { exact: true }).fill(secret)
      await page.getByLabel('Recovery phrase', { exact: true }).press('Enter')
      await page.locator(`body.room-${expectedKind}`).waitFor()
      assert.equal(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length), 0, 'No browser storage')
    }
    async function revealHints() {
      const help = page.locator('#room > .help')
      await help.locator('summary').focus()
      await page.keyboard.press('Enter')
      const more = help.getByRole('button', { name: 'A little more' })
      await more.focus()
      await page.keyboard.press('Enter')
      await page.keyboard.press('Enter')
      assert.ok(await more.isDisabled(), 'Hint sequence ends after all three clues')
      assert.equal(await help.locator('p').count(), 3, 'All progressive hints are readable')
    }
    async function followReceipt() {
      const phrase = await page.locator('#next-phrase').inputValue()
      const href = await page.locator('.continue-link').getAttribute('href')
      await page.locator('.continue-link').focus()
      await page.keyboard.press('Enter')
      await page.waitForURL(`${base}${href}`)
      return phrase
    }

    await page.goto(base)
    // Verify existing text, links and images survived unchanged.
    const original = execFileSync('git', ['show', 'HEAD:index.html'], { encoding: 'utf8' })
    assert.ok(await page.evaluate(html => {
      const previous = new DOMParser().parseFromString(html, 'text/html')
      return previous.querySelector('main').innerHTML === document.querySelector('main').innerHTML
        && [...previous.querySelectorAll('nav a')].map(a => a.getAttribute('href')).join() === [...document.querySelectorAll('footer nav a')].map(a => a.getAttribute('href')).join()
    }, original), 'Public content and contact links preserved')
    await screenshot('home')
    await page.locator('#earlier-copy > summary').focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('#directory').evaluate(node => node === document.activeElement), true, 'Footer form is next in keyboard order')
    await page.locator('#directory').fill('incorrect')
    await page.locator('#directory').press('Enter')
    await page.getByText('That directory does not match', { exact: false }).waitFor()
    await page.locator('#earlier-copy .help summary').focus()
    await page.keyboard.press('Enter')
    await page.locator('#earlier-copy .help button').focus()
    await page.keyboard.press('Enter')
    const numbers = await page.locator('#earlier-copy > summary').textContent()
    const answer = numbers.match(/\d+/g).map(n => String.fromCharCode(Number(n) + 64)).join('')
    await page.locator('#directory').fill(answer)
    await page.locator('#directory').press('Enter')
    await page.locator('#next-phrase').waitFor()
    await page.keyboard.press('Tab')
    assert.equal(await page.locator('#next-phrase').evaluate(node => node === document.activeElement), true, 'Receipt phrase follows its focused heading')
    await checkPage('homepage discovery')
    const wiredPhrase = await followReceipt()
    await checkPage('direct connection gate')
    await page.locator('#phrase').fill(answer)
    await page.locator('#phrase').press('Enter')
    await page.getByText('That phrase did not open', { exact: false }).waitFor()
    assert.equal(await page.locator('.transmission-text').count(), 0, 'Wrong secret reveals no story')
    await unlock(wiredPhrase, 'transmission')
    await page.getByRole('button', { name: 'Recover next revision' }).focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'No further saved revision' }).waitFor()
    await page.locator('#next-directory').fill('wrong')
    await page.locator('#next-directory').press('Enter')
    await page.getByText('No directory recovered.', { exact: false }).waitFor()
    await revealHints()
    await checkPage('recovered connection')
    await screenshot('connection')
    const messages = await page.locator('.log-message').allTextContents()
    await page.locator('#next-directory').fill(messages.map(s => s[0]).join(''))
    await page.locator('#next-directory').press('Enter')
    await page.locator('#next-phrase').waitFor()
    const archivePhrase = await followReceipt()
    // Reload a nested URL as on static hosting. It must remain a locked page.
    await page.reload()
    await page.locator('#phrase').waitFor()
    await unlock(archivePhrase, 'archive')
    await checkPage('archive empty state')
    const files = await page.locator('.file-button').allTextContents()
    const recovered = []
    for (const name of files) {
      await page.getByRole('button', { name, exact: true }).focus()
      await page.keyboard.press('Enter')
      await page.getByRole('heading', { level: 2, name, exact: true }).waitFor()
      await page.locator('.comparison summary').focus()
      await page.keyboard.press('Enter')
      const revision = Number(await page.locator('.file-metadata dd').first().textContent())
      const word = (await page.locator('.margin-fragment').textContent()).replace('Margin: ', '')
      recovered.push({ name, revision, word })
      await checkPage('archive comparison')
    }
    await revealHints()
    await checkPage('archive hints')
    await screenshot('archive')
    const selects = page.locator('.reconstruction select')
    await page.locator('#restored-address').fill('incorrect address')
    for (let i = 0; i < 6; i++) await selects.nth(i).selectOption({ label: files[0] })
    await page.getByRole('button', { name: 'Restore the missing address' }).focus()
    await page.keyboard.press('Enter')
    await page.getByText('A copy appears twice.', { exact: false }).waitFor()
    for (let i = 0; i < 6; i++) await selects.nth(i).selectOption({ label: files[i] })
    await page.getByRole('button', { name: 'Restore the missing address' }).press('Enter')
    await page.getByText('These copies do not fit', { exact: false }).waitFor()
    recovered.sort((a, b) => a.revision - b.revision)
    for (let i = 0; i < 6; i++) await selects.nth(i).selectOption({ label: recovered[i].name })
    await page.getByRole('button', { name: 'Restore the missing address' }).press('Enter')
    await page.getByText('The files are in order.', { exact: false }).waitFor()
    await page.locator('#restored-address').fill(recovered.map(f => f.word).join(' '))
    await page.locator('#restored-address').press('Enter')
    await page.locator('#next-phrase').waitFor()
    const finalRoute = await page.locator('.continue-link').getAttribute('href')
    assert.ok(finalRoute === `/${recovered.map(f => f.word).join('-')}/`, 'Recovered margin words match the final URL')
    const endingPhrase = await followReceipt()
    await page.reload()
    await unlock(endingPhrase, 'ending')
    await checkPage('ending')
    await screenshot('ending')
    await page.getByRole('link', { name: 'Back to the page you came from' }).focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(`${base}/`)
    await context.close()
    console.log(`${scenario.name}: complete keyboard puzzle path, wrong answers, direct reloads, responsive layout, motion preference and axe checks passed.`)
  }
  const futureStrings = chapter.stages.slice(1).map(stage => stage.secret)
  function collect(value, key = '') {
    if (['id', 'order', 'route'].includes(key)) return
    if (typeof value === 'string' && (value.length >= 24 || key === 'title' || key === 'eyebrow')) futureStrings.push(value)
    else if (Array.isArray(value)) value.forEach(item => collect(item, key))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([name, item]) => collect(item, name))
  }
  chapter.stages.forEach(stage => collect(stage.content))
  chapter.documents.forEach(doc => collect(doc.content))
  assert.ok(!networkTexts.some(text => futureStrings.some(secret => text.includes(secret))), 'No story plaintext or future phrase in network responses')
  assert.equal(issues.length, 0, 'No console/page/network errors')
  console.log('Network responses contain no narrative plaintext or future phrases. Screenshots saved only in the private authoring workspace.')
} catch (error) {
  // Playwright call logs can echo form values. Never print those logs/phrases.
  console.error(error instanceof assert.AssertionError ? error.message : 'Browser verification failed. Private call details withheld; inspect the current step locally.')
  process.exitCode = 1
} finally {
  await browser?.close()
  server.kill()
}
