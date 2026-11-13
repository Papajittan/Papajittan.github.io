import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto'
import { seal, unseal, iterations } from '../src/arg/crypto.mjs'

test('correct phrase decrypts; wrong phrase and tampered content fail', async () => {
  const phrase = randomBytes(24).toString('base64url')
  const content = { text: 'Synthetic test document; not story content.' }
  const envelope = await seal(content, phrase, 'test-document')
  assert.deepEqual(await unseal(envelope, phrase, 'test-document'), content)
  await assert.rejects(unseal(envelope, `${phrase}x`, 'test-document'))
  const corrupted = Buffer.from(envelope.ciphertext, 'base64')
  corrupted[0] ^= 1
  await assert.rejects(unseal({ ...envelope, ciphertext: corrupted.toString('base64') }, phrase, 'test-document'))
  await assert.rejects(unseal(envelope, phrase, 'another-document'))
  await assert.rejects(unseal({ ...envelope, iterations: 1 }, phrase, 'test-document'))
})

test('independent files and repeated encryption receive fresh salts and nonces', async () => {
  const phrase = randomBytes(24).toString('base64url')
  const a = await seal({ fixture: 1 }, phrase, 'a')
  const b = await seal({ fixture: 1 }, phrase, 'a')
  assert.notEqual(a.salt, b.salt)
  assert.notEqual(a.nonce, b.nonce)
  assert.notEqual(a.ciphertext, b.ciphertext)
})

test('browser format interoperates with independent Node AES-GCM implementation', async () => {
  const phrase = randomBytes(24).toString('base64url')
  const salt = randomBytes(16)
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', pbkdf2Sync(phrase, salt, iterations, 32, 'sha256'), nonce)
  cipher.setAAD(Buffer.from('preserved-page:1:independent'))
  const ciphertext = Buffer.concat([cipher.update('{"fixture":"independent"}'), cipher.final(), cipher.getAuthTag()])
  const envelope = { version: 1, id: 'independent', iterations, salt: salt.toString('base64'), nonce: nonce.toString('base64'), ciphertext: ciphertext.toString('base64') }
  assert.deepEqual(await unseal(envelope, phrase, 'independent'), { fixture: 'independent' })
})
