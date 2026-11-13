export interface Envelope {
  version: number
  id: string
  iterations: number
  salt: string
  nonce: string
  ciphertext: string
}
export const iterations: number
export function normalizeSecret(secret: string): string
export function seal(content: unknown, secret: string, id: string): Promise<Envelope>
export function unseal(envelope: Envelope, secret: string, expectedId: string): Promise<unknown>
