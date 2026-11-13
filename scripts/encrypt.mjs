import { readFile, writeFile, mkdir, readdir, realpath, chmod } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { seal } from '../src/arg/crypto.mjs'

const root = process.cwd()
const authorDir = await realpath(resolve(process.env.ARG_AUTHOR_DIR || '../AboutMe-authoring'))
const rel = relative(root, authorDir)
if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..')) throw new Error('Authoring must be outside the public repository')
const chapterPath = resolve(authorDir, 'chapter.json')
await chmod(chapterPath, 0o600)
let chapter
try { chapter = JSON.parse(await readFile(chapterPath, 'utf8')) }
catch { throw new Error('Cannot read private chapter.json as JSON. Review it locally; private details withheld.') }
const records = [...chapter.stages, ...chapter.documents]
const ids = new Set()
for (const item of records) {
  if (!/^[a-f0-9]{32}$/.test(item.id) || ids.has(item.id)) throw new Error('Invalid or repeated asset ID')
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(item.secret)) throw new Error('Use independently generated high-entropy access phrases')
  ids.add(item.id)
}
for (const stage of chapter.stages) {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(stage.route) || ['src', 'public', 'scripts', 'tests', 'docs', 'node_modules', 'dist'].includes(stage.route)) throw new Error('Invalid route')
}
await mkdir('public/capsules', { recursive: true })
for (const item of records) {
  const envelope = await seal(item.content, item.secret, item.id)
  await writeFile(`public/capsules/${item.id}.json`, JSON.stringify(envelope))
}
// Old ciphertext may contain retired text. Refuse silently leaving it behind.
const stale = (await readdir('public/capsules')).filter((name) => !ids.has(name.replace(/\.json$/, '')))
if (stale.length) throw new Error('Stale capsule files exist; review and remove retired generated assets before publishing')
await writeFile('public/connection.json', JSON.stringify({ phrase: chapter.stages[0].secret }))
const template = await readFile('scripts/room.html', 'utf8')
for (const stage of chapter.stages) {
  await mkdir(stage.route, { recursive: true })
  await writeFile(`${stage.route}/index.html`, template.replace('ASSET_ID', stage.id))
}
console.log(`Encrypted ${records.length} independent assets; generated ${chapter.stages.length} static page shells. No private values logged.`)
