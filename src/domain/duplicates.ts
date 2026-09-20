import { createHash } from 'node:crypto'
import { normaliseName, normalisePhone } from './validation'

export type ExistingLead = { phone?: string; name?: string; messageFingerprint?: string; receivedAt: Date; idempotencyKey?: string }

export function messageFingerprint(message: string | undefined) {
  return createHash('sha256').update((message || '').trim().toLocaleLowerCase('en-GB')).digest('hex')
}

export function findDuplicate(input: { phone: string; name: string; message?: string; idempotencyKey?: string; receivedAt?: Date }, existing: ExistingLead[], windowMinutes = 30) {
  const receivedAt = input.receivedAt || new Date()
  const phone = normalisePhone(input.phone)
  const name = normaliseName(input.name)
  const fingerprint = messageFingerprint(input.message)
  return existing.find((lead) => {
    const withinWindow = Math.abs(receivedAt.getTime() - lead.receivedAt.getTime()) <= windowMinutes * 60 * 1000
    if (!withinWindow) return false
    if (input.idempotencyKey && lead.idempotencyKey === input.idempotencyKey) return true
    return lead.phone === phone && lead.name === name && lead.messageFingerprint === fingerprint
  })
}
