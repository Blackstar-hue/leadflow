import { describe, expect, it } from 'vitest'
import { categoriseLead } from '../src/domain/categorise'
import { findDuplicate, messageFingerprint } from '../src/domain/duplicates'
import { chooseRenter } from '../src/domain/routing'
import { normaliseName, normalisePhone, parseLeadInput } from '../src/domain/validation'

describe('lead validation', () => {
  it('accepts the legacy form shape and applies safe defaults', () => {
    const lead = parseLeadInput({ name: ' Jamie Smith ', phone: '0044 7401 471852', message: 'A leaking tap' })
    expect(lead.name).toBe('Jamie Smith')
    expect(lead.sourceChannel).toBe('form')
    expect(normalisePhone(lead.phone)).toBe('+447401471852')
  })

  it('normalises names without changing the stored display value', () => {
    expect(normaliseName('  Jamie   Smith ')).toBe('jamie smith')
  })
})

describe('categorisation', () => {
  it('prioritises emergency plumbing language', () => {
    const result = categoriseLead({ service: 'Plumbing', message: 'Emergency burst pipe, please help today' })
    expect(result.serviceCategory).toBe('Plumbing')
    expect(result.urgency).toBe('Emergency')
    expect(result.leadQuality).toBe('High')
  })

  it('marks obvious SEO spam as low quality', () => {
    expect(categoriseLead({ message: 'Guest post and backlink package' }).leadQuality).toBe('Low')
  })
})

describe('duplicate detection', () => {
  it('matches the same contact and message inside the configured window', () => {
    const now = new Date('2026-09-20T10:00:00Z')
    const existing = [{ phone: '+447401471852', name: 'jamie smith', messageFingerprint: messageFingerprint('Leaking tap'), receivedAt: now }]
    expect(findDuplicate({ phone: '0044 7401 471852', name: 'Jamie Smith', message: 'Leaking tap', receivedAt: new Date('2026-09-20T10:20:00Z') }, existing)).toBeTruthy()
  })

  it('does not merge a later genuine enquiry', () => {
    const now = new Date('2026-09-20T10:00:00Z')
    const existing = [{ phone: '+447401471852', name: 'jamie smith', messageFingerprint: messageFingerprint('Leaking tap'), receivedAt: now }]
    expect(findDuplicate({ phone: '0044 7401 471852', name: 'Jamie Smith', message: 'New boiler quote', receivedAt: new Date('2026-09-20T11:00:00Z') }, existing)).toBeUndefined()
  })
})

describe('routing', () => {
  it('uses priority then only available category matches', () => {
    const renter = chooseRenter([
      { renterId: 'low', name: 'Low priority', priority: 1, available: true, categories: ['Plumbing'] },
      { renterId: 'high', name: 'High priority', priority: 5, available: true, categories: ['Plumbing'] },
      { renterId: 'offline', name: 'Offline', priority: 99, available: false, categories: ['Plumbing'] },
    ], 'Plumbing')
    expect(renter?.renterId).toBe('high')
  })
})
