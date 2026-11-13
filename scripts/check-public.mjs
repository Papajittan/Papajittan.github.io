import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function filesWithin(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    if (entry.isSymbolicLink()) throw new Error('Symlinks are not allowed in release artifacts')
    const file = join(dir, entry.name)
    return entry.isDirectory() ? filesWithin(file) : [file]
  }))
  return nested.flat()
}

export function checkEnvelope(envelope, fileId) {
  const expected = ['ciphertext', 'id', 'iterations', 'nonce', 'salt', 'version']
  if (JSON.stringify(Object.keys(envelope).sort()) !== JSON.stringify(expected)) throw new Error('Unexpected public capsule fields')
  if (envelope.version !== 1 || envelope.id !== fileId || envelope.iterations !== 600_000) throw new Error('Invalid public capsule format')
  for (const [field, length] of [['salt', 16], ['nonce', 12]]) {
    if (typeof envelope[field] !== 'string' || Buffer.from(envelope[field], 'base64').length !== length) throw new Error('Invalid public cryptographic parameters')
  }
  if (typeof envelope.ciphertext !== 'string' || Buffer.from(envelope.ciphertext, 'base64').length < 16) throw new Error('Invalid ciphertext')
}

export async function verifyPublic(dir = 'dist') {
  const files = await filesWithin(dir)
  let capsules = 0
  let pages = 0
  for (const file of files) {
    const name = relative(dir, file).replaceAll('\\', '/')
    if (name === 'index.html' || /^[a-z][a-z0-9-]+\/index\.html$/.test(name)) pages++
    else if (/^capsules\/[a-f0-9]{32}\.json$/.test(name)) {
      checkEnvelope(JSON.parse(await readFile(file, 'utf8')), name.slice(9, -5))
      capsules++
      continue
    } else if (name === 'connection.json') {
      const receipt = JSON.parse(await readFile(file, 'utf8'))
      if (Object.keys(receipt).join() !== 'phrase' || !/^[A-Za-z0-9_-]{32,80}$/.test(receipt.phrase)) throw new Error('Invalid entry receipt')
      continue
    } else if (!/^(?:assets\/[A-Za-z0-9_.-]+\.(?:js|css|woff2?|png)|lain-(?:peek|bear)\.png)$/.test(name)) {
      throw new Error(`Unexpected deployment file: ${name}`)
    }
    if (/\.(?:html|js|css)$/.test(name)) {
      const text = await readFile(file, 'utf8')
      if (text.includes('sourceMappingURL=') || text.includes('BEGIN PRIVATE KEY')) throw new Error('Source map or private key found in deployment')
    }
  }
  if (pages !== 4 || capsules !== 9) throw new Error('Chapter is incomplete: expected four pages and nine encrypted assets')
  return { files: files.length, pages, capsules }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await verifyPublic(process.argv[2] || 'dist')
  console.log(`Public build verified: ${result.pages} pages, ${result.capsules} ciphertext assets; only deployment files, no source maps.`)
}
