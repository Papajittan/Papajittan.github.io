import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkEnvelope, verifyPublic } from '../scripts/check-public.mjs'

test('deployment verifier rejects plaintext fields in ciphertext envelopes', () => {
  const envelope = { version: 1, id: 'a'.repeat(32), iterations: 600_000, salt: Buffer.alloc(16).toString('base64'), nonce: Buffer.alloc(12).toString('base64'), ciphertext: Buffer.alloc(32).toString('base64') }
  assert.doesNotThrow(() => checkEnvelope(envelope, envelope.id))
  assert.throws(() => checkEnvelope({ ...envelope, story: 'synthetic unrevealed text' }, envelope.id))
  assert.throws(() => checkEnvelope({ ...envelope, secret: 'synthetic private phrase' }, envelope.id))
})

test('release verifier detects source maps, source files, and narrative files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'arg-release-test-'))
  try {
    // Each forbidden file must fail before the completeness check.
    for (const name of ['index.js.map', 'story.txt', 'chapter.json', 'private.ts']) {
      const file = join(dir, name)
      await writeFile(file, 'synthetic fixture')
      await assert.rejects(verifyPublic(dir), /Unexpected deployment file/)
      await rm(file)
    }
  } finally { await rm(dir, { recursive: true, force: true }) }
})
