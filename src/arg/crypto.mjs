// Shared by the offline tool and browser. No content or access phrases belong here.
export const iterations = 600_000
const encoder = new TextEncoder()
const aad = (id) => encoder.encode(`preserved-page:1:${id}`)
const to64 = (bytes) => btoa(String.fromCharCode(...bytes))
const from64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0))

export function normalizeSecret(secret) {
  return secret.trim().normalize('NFKC')
}

async function derive(secret, salt, usages) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(normalizeSecret(secret)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, usages)
}

export async function seal(content, secret, id) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const key = await derive(secret, salt, ['encrypt'])
  const data = encoder.encode(JSON.stringify(content))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(id), tagLength: 128 }, key, data)
  return { version: 1, id, iterations, salt: to64(salt), nonce: to64(nonce), ciphertext: to64(new Uint8Array(encrypted)) }
}

export async function unseal(envelope, secret, expectedId) {
  if (envelope.version !== 1 || envelope.id !== expectedId || envelope.iterations !== iterations) throw new Error('Invalid envelope')
  const salt = from64(envelope.salt)
  const nonce = from64(envelope.nonce)
  const ciphertext = from64(envelope.ciphertext)
  if (salt.length !== 16 || nonce.length !== 12 || ciphertext.length < 16 || ciphertext.length > 256_000) throw new Error('Invalid envelope')
  const key = await derive(secret, salt, ['decrypt'])
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(expectedId), tagLength: 128 }, key, ciphertext)
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data))
}
