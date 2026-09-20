import { z } from 'zod'
import type { LeadInput } from './types'

const optionalText = z.string().trim().max(500).optional().or(z.literal(''))

export const leadInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(40),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  message: optionalText,
  service: optionalText,
  websiteDomain: z.string().trim().max(253).optional().or(z.literal('')),
  assetKey: z.string().trim().max(120).optional().or(z.literal('')),
  sourceChannel: z.enum(['form', 'call', 'gmb', 'manual']).default('form'),
  idempotencyKey: z.string().trim().max(200).optional().or(z.literal('')),
  honeypot: z.string().max(200).optional().or(z.literal('')),
  postcodeArea: optionalText,
  city: optionalText,
  gclid: optionalText,
  gbraid: optionalText,
  wbraid: optionalText,
  utmSource: optionalText,
  utmMedium: optionalText,
  utmCampaign: optionalText,
  landingPage: z.string().trim().url().max(2048).optional().or(z.literal('')),
  referrer: z.string().trim().url().max(2048).optional().or(z.literal('')),
  consent: z.boolean().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
})

export function parseLeadInput(payload: unknown): LeadInput {
  return leadInputSchema.parse(payload) as LeadInput
}

export function normalisePhone(phone: string) {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  return digits
}

export function normaliseName(name: string) {
  return name.trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ')
}

export function cleanText(value: string | undefined, max = 500) {
  return value?.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) || ''
}
