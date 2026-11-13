import { readFile, realpath } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { execFileSync } from 'node:child_process'
import { unseal } from '../src/arg/crypto.mjs'
import { filesWithin, verifyPublic } from './check-public.mjs'

const authorDir = await realpath(resolve(process.env.ARG_AUTHOR_DIR || '../AboutMe-authoring'))
const rel = relative(process.cwd(), authorDir)
if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..')) throw new Error('Private authoring must be external')
let chapter
try { chapter = JSON.parse(await readFile(resolve(authorDir, 'chapter.json'), 'utf8')) }
catch { throw new Error('Cannot read private chapter.json as JSON. Review it locally; private details withheld.') }
await verifyPublic()
const items = [...chapter.stages, ...chapter.documents]
const protectedStrings = new Set(chapter.stages.slice(1).map(item => item.secret))
function collect(value, key = '') {
  if (['id', 'order', 'route'].includes(key)) return // Necessary public asset/URL metadata is not narrative.
  if (typeof value === 'string' && (value.length >= 24 || key === 'title' || key === 'eyebrow')) protectedStrings.add(value)
  else if (Array.isArray(value)) value.forEach(item => collect(item, key))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([name, item]) => collect(item, name))
}
items.forEach(item => collect(item.content))
const publicFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const distFiles = await filesWithin('dist')
for (const file of [...publicFiles, ...distFiles]) {
  if (/(?:^|\/)(?:chapter\.json|[^/]*solution-guide[^/]*|[^/]*\.secret|\.env)(?:$|\/)|(?:^|\/)(?:private|authoring|\.arg-private)\//i.test(file)) throw new Error('Private authoring file found among public candidates; contents withheld')
  const text = await readFile(file, 'utf8')
  for (const secret of protectedStrings) {
    if (text.includes(secret) || text.includes(JSON.stringify(secret).slice(1, -1))) throw new Error(`Private narrative or future access phrase found in ${file}; values withheld`)
  }
}
for (const item of items) {
  const envelope = JSON.parse(await readFile(`dist/capsules/${item.id}.json`, 'utf8'))
  const recovered = await unseal(envelope, item.secret, item.id)
  if (JSON.stringify(recovered) !== JSON.stringify(item.content)) throw new Error('Content differs from the private authoring source')
  let rejected = false
  try { await unseal(envelope, `${item.secret}x`, item.id) } catch { rejected = true }
  if (!rejected) throw new Error('Incorrect phrase unexpectedly decrypted an asset')
}
console.log(`Private verification passed: ${items.length} production assets round-trip, ${items.length} wrong phrases fail; no private passages or future phrases in public source/build.`)
