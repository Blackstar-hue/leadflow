import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'

let prisma

const knownAssets = [
  { id: 'AG-001', name: 'Premier Plumbing Portsmouth', type: 'Website + GMB', domain: 'premierplumbingportsmouth.xyz', status: 'Connected', leads: 0, phone: '+44 7401 471852', colour: 'blue' },
  { id: 'AG-002', name: 'Premier Gutter and Cladding Portsmouth', type: 'Website + GMB', domain: 'premiergutterandcladdingportsmouth.xyz', status: 'Connected', leads: 0, phone: '+44 7307 273963', colour: 'violet' },
  { id: 'AG-003', name: 'United Masonry Northampton', type: 'Website + GMB', domain: 'unitedmasonrynorthampton.xyz', status: 'Connected', leads: 0, phone: '+44 7576 552408', colour: 'amber' },
  { id: 'PENDING-004', name: 'Ashwood Tree Surgeons Corby', type: 'Website + GMB', domain: 'Domain pending', status: 'Needs setup', leads: 0, phone: 'Phone pending', colour: 'green' },
  { id: 'PENDING-005', name: 'Sunshine Solar Cleaning Corby', type: 'Website + GMB', domain: 'Domain pending', status: 'Needs setup', leads: 0, phone: 'Phone pending', colour: 'rose' },
]

export function databaseEnabled() { return Boolean(process.env.DATABASE_URL) }

export async function databaseHealthy() {
  const client = db()
  if (!client) return false
  try { await client.$queryRaw`SELECT 1`; return true } catch { return false }
}

export async function recordWebhookEvent(provider, eventId, payload) {
  if (!eventId) return { duplicate: false, persisted: false }
  const client = db()
  if (!client) return { duplicate: false, persisted: false }
  try {
    await client.webhookEvent.create({ data: { provider, eventId, payload } })
    return { duplicate: false, persisted: true }
  } catch (error) {
    if (error?.code === 'P2002') return { duplicate: true, persisted: true }
    throw error
  }
}

function db() {
  if (!databaseEnabled()) return null
  prisma ||= new PrismaClient()
  return prisma
}

function fingerprint(phone, name, message) {
  return createHash('sha256').update(`${phone}|${name.toLocaleLowerCase('en-GB')}|${message.toLocaleLowerCase('en-GB')}`).digest('hex')
}

function categorise(service, message) {
  const text = `${service || ''} ${message || ''}`.trim()
  const rules = [
    ['Plumbing', /plumb|boiler|heating|radiator|leak|toilet|tap|pipe|drain/i],
    ['Guttering', /gutter|downpipe|fascia|soffit|roofline/i],
    ['Cladding', /cladding|render/i],
    ['Masonry', /mason|brick|repoint|wall|stone|patio/i],
    ['Tree surgery', /tree|stump|hedge|arbor/i],
    ['Solar panel cleaning', /solar|panel|photovoltaic/i],
  ]
  const serviceCategory = rules.find(([, rule]) => rule.test(text))?.[0] || 'General enquiry'
  const emergency = /emergency|urgent|flood|burst|no heat|danger|fallen tree/i.test(text)
  const high = /today|asap|soon|leak|blocked|unsafe/i.test(text)
  const spam = /seo|casino|crypto|viagra|backlink|guest post/i.test(text)
  return {
    serviceCategory,
    urgency: emergency ? 'EMERGENCY' : high ? 'HIGH' : 'NORMAL',
    leadQuality: spam ? 'LOW' : emergency || text.length > 35 ? 'HIGH' : text.length > 10 ? 'MEDIUM' : 'LOW',
    spamLikelihood: spam ? 0.92 : 0.04,
    summary: text.length > 140 ? `${text.slice(0, 137)}...` : text || 'No message supplied',
  }
}

function titleCase(value) { return String(value || '').toLowerCase().replace(/(^|_)([a-z])/g, (_, separator, letter) => `${separator ? ' ' : ''}${letter.toUpperCase()}`) }

function conditionMatches(value, expected) {
  if (expected === undefined || expected === null || expected === '') return true
  return Array.isArray(expected) ? expected.includes(value) : expected === value
}

async function chooseRenter(client, asset, categorised, sourceChannel) {
  const rules = await client.routingRule.findMany({ where: { workspaceId: asset.workspaceId, active: true }, orderBy: { priority: 'asc' } })
  const values = { assetId: asset.assetId, businessId: asset.businessId, websiteId: asset.websiteId, serviceCategory: categorised.serviceCategory, leadQuality: categorised.leadQuality, sourceChannel }
  const matchingRule = rules.find((rule) => !rule.fallback && Object.entries(rule.conditions || {}).every(([key, expected]) => conditionMatches(values[key], expected))) || rules.find((rule) => rule.fallback)
  if (!matchingRule?.renterId) return null
  return client.renter.findFirst({ where: { id: matchingRule.renterId, workspaceId: asset.workspaceId, active: true, available: true } })
}

function publicLead(lead) {
  return {
    id: lead.id,
    received: new Date(lead.receivedAt || lead.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
    name: lead.name,
    phone: lead.phone,
    email: lead.email || undefined,
    service: lead.serviceCategory,
    summary: lead.leadSummary || lead.originalMessage || 'No message supplied',
    urgency: titleCase(lead.urgency),
    quality: titleCase(lead.leadQuality),
    status: titleCase(lead.status),
    website: lead.websiteDomain || lead.gmbName || 'Unknown source',
    assetId: lead.gmbAsset?.assetId || '',
    renter: lead.assignedRenter?.name || '',
    source: lead.sourceChannel === 'FORM' ? 'Website form' : lead.sourceChannel === 'CALL' ? 'Twilio call' : titleCase(lead.sourceChannel),
    demo: false,
  }
}

export async function listAssets() {
  const client = db()
  if (!client) return knownAssets
  const rows = await client.gmbAsset.findMany({ include: { _count: { select: { leads: true } }, website: true }, orderBy: { assetId: 'asc' } })
  return rows.map((asset) => ({
    id: asset.assetId,
    name: asset.name,
    type: 'Website + GMB',
    domain: asset.website?.domain || 'Domain pending',
    status: titleCase(asset.status) === 'Connected' ? 'Connected' : 'Needs setup',
    leads: asset._count.leads,
    phone: asset.phone || 'Phone pending',
    colour: knownAssets.find((item) => item.id === asset.assetId)?.colour || 'blue',
  }))
}

export async function listLeads() {
  const client = db()
  if (!client) return []
  const rows = await client.lead.findMany({ include: { gmbAsset: true, assignedRenter: true }, orderBy: { receivedAt: 'desc' }, take: 500 })
  return rows.map(publicLead)
}

export async function listRenters() {
  const client = db()
  if (!client) return []
  const rows = await client.renter.findMany({ orderBy: [{ active: 'desc' }, { priority: 'desc' }, { name: 'asc' }] })
  return rows.map((renter) => ({ id: renter.id, name: renter.name, company: renter.company || '', email: renter.email || '', phone: renter.phone || '', categories: renter.categories, available: renter.available, priority: renter.priority, active: renter.active }))
}

export async function createRenter(input) {
  const client = db()
  if (!client) throw new Error('database_required')
  const workspace = await client.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!workspace) throw new Error('workspace_not_found')
  const name = String(input.name || '').trim().slice(0, 120)
  if (name.length < 2) throw new Error('invalid_renter')
  const renter = await client.$transaction(async (tx) => {
    const created = await tx.renter.create({ data: {
    workspaceId: workspace.id,
    name,
    company: String(input.company || '').trim().slice(0, 160) || null,
    email: String(input.email || '').trim().slice(0, 254) || null,
    phone: String(input.phone || '').trim().slice(0, 40) || null,
    categories: Array.isArray(input.categories) ? input.categories.map((item) => String(item).trim()).filter(Boolean).slice(0, 20) : [],
    priority: Number.isFinite(Number(input.priority)) ? Math.max(0, Math.min(999, Number(input.priority))) : 0,
    } })
    await tx.auditLog.create({ data: { workspaceId: workspace.id, action: 'RENTER_CREATED', entityType: 'Renter', entityId: created.id, after: { name: created.name, company: created.company, categories: created.categories, priority: created.priority } } })
    return created
  })
  return { id: renter.id, name: renter.name, company: renter.company || '', email: renter.email || '', phone: renter.phone || '', categories: renter.categories, available: renter.available, priority: renter.priority, active: renter.active }
}

export async function listRoutingRules() {
  const client = db()
  if (!client) return []
  const rows = await client.routingRule.findMany({ where: { active: true }, orderBy: { priority: 'asc' } })
  const renterIds = rows.map((rule) => rule.renterId).filter(Boolean)
  const renters = renterIds.length ? await client.renter.findMany({ where: { id: { in: renterIds } }, select: { id: true, name: true } }) : []
  const renterNames = new Map(renters.map((renter) => [renter.id, renter.name]))
  return rows.map((rule) => ({ id: rule.id, name: rule.name, priority: rule.priority, conditions: rule.conditions, renterId: rule.renterId, renterName: rule.renterId ? renterNames.get(rule.renterId) || '' : '', fallback: rule.fallback, active: rule.active }))
}

export async function createWebsiteLead(assetKey, input) {
  const result = categorise(input.service, input.message)
  const messageHash = fingerprint(input.phone, input.name, input.message)
  const client = db()
  if (!client) return { lead: { id: `local_${Date.now().toString(36)}`, assetKey, ...input, ...result, messageHash, receivedAt: Date.now() }, duplicate: false, persisted: false }

  const asset = await client.gmbAsset.findFirst({ where: { assetId: assetKey, status: 'CONNECTED' } })
  if (!asset) throw new Error('asset_not_connected')
  const since = new Date(Date.now() - 1_800_000)
  const duplicateChecks = [{ phone: input.phone, messageFingerprint: messageHash }]
  if (input.idempotencyKey) duplicateChecks.unshift({ idempotencyKey: input.idempotencyKey })
  const duplicate = await client.lead.findFirst({ where: { workspaceId: asset.workspaceId, gmbAssetId: asset.id, receivedAt: { gte: since }, OR: duplicateChecks } })
  if (duplicate) return { lead: publicLead(duplicate), duplicate: true, persisted: true }
  const lead = await client.$transaction(async (tx) => {
    const renter = await chooseRenter(tx, asset, result, 'FORM')
    const created = await tx.lead.create({ data: {
      workspaceId: asset.workspaceId,
      businessId: asset.businessId,
      websiteId: asset.websiteId,
      gmbAssetId: asset.id,
      websiteDomain: input.websiteDomain || null,
      gmbName: asset.name,
      sourceChannel: 'FORM',
      leadType: 'FORM',
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      originalMessage: input.message || null,
      serviceCategory: result.serviceCategory,
      leadSummary: result.summary,
      urgency: result.urgency,
      leadQuality: result.leadQuality,
      spamLikelihood: result.spamLikelihood,
      idempotencyKey: input.idempotencyKey || null,
      messageFingerprint: messageHash,
      rawPayload: input.metadata || undefined,
      assignedRenterId: renter?.id || null,
      assignedAt: renter ? new Date() : null,
      status: renter ? 'ASSIGNED' : 'NEW',
    }, include: { gmbAsset: true, assignedRenter: true } })
    await tx.leadEvent.create({ data: { workspaceId: asset.workspaceId, leadId: created.id, type: 'RECEIVED', metadata: { source: 'FORM', assetKey } } })
    await tx.leadEvent.create({ data: { workspaceId: asset.workspaceId, leadId: created.id, type: 'CATEGORISED', metadata: result } })
    await tx.leadEvent.create({ data: { workspaceId: asset.workspaceId, leadId: created.id, type: renter ? 'ASSIGNED' : 'ROUTING_FAILED', metadata: renter ? { renterId: renter.id } : { reason: 'no_matching_available_renter' } } })
    return created
  })
  return { lead: publicLead(lead), duplicate: false, persisted: true }
}

export async function recordCall(payload, assetKey) {
  const client = db()
  if (!client) return { persisted: false, callId: payload.CallSid || payload.call_sid }
  if (!assetKey) throw new Error('asset_not_mapped')
  const asset = await client.gmbAsset.findFirst({ where: { assetId: assetKey } })
  if (!asset) throw new Error('asset_not_found')
  const callId = payload.CallSid || payload.call_sid
  const existing = await client.callRecord.findFirst({ where: { workspaceId: asset.workspaceId, notes: { contains: `twilio:${callId}` } }, include: { lead: true } })
  if (existing) {
    await client.callRecord.update({ where: { id: existing.id }, data: {
      receivedAt: payload.Timestamp ? new Date(payload.Timestamp) : existing.receivedAt,
      trackingNumber: payload.To || existing.trackingNumber,
      callerNumber: payload.From || payload.Caller || existing.callerNumber,
      durationSeconds: Number(payload.CallDuration || payload.Duration || 0) || existing.durationSeconds,
      recordingUrl: payload.RecordingUrl || existing.recordingUrl,
      status: payload.CallStatus || existing.status,
    } })
    return { persisted: true, duplicate: true, callId, leadId: existing.leadId }
  }
  const caller = payload.From || payload.Caller || 'Unknown caller'
  const lead = await client.$transaction(async (tx) => {
    const categorised = { serviceCategory: 'General enquiry', leadQuality: 'MEDIUM' }
    const renter = await chooseRenter(tx, asset, categorised, 'CALL')
    const createdLead = await tx.lead.create({ data: {
      workspaceId: asset.workspaceId,
      businessId: asset.businessId,
      websiteId: asset.websiteId,
      gmbAssetId: asset.id,
      gmbName: asset.name,
      sourceChannel: 'CALL',
      leadType: 'CALL',
      name: caller,
      phone: caller,
      originalMessage: 'Inbound call received via Twilio.',
      serviceCategory: 'General enquiry',
      leadSummary: 'Inbound call received via Twilio.',
      urgency: 'NORMAL',
      leadQuality: 'MEDIUM',
      spamLikelihood: 0,
      rawPayload: payload,
      assignedRenterId: renter?.id || null,
      assignedAt: renter ? new Date() : null,
      status: renter ? 'ASSIGNED' : 'NEW',
    }, include: { gmbAsset: true, assignedRenter: true } })
    await tx.callRecord.create({ data: {
      workspaceId: asset.workspaceId,
      leadId: createdLead.id,
      gmbAssetId: asset.id,
      receivedAt: payload.Timestamp ? new Date(payload.Timestamp) : new Date(),
      trackingNumber: payload.To || null,
      callerNumber: caller,
      durationSeconds: Number(payload.CallDuration || payload.Duration || 0) || null,
      recordingUrl: payload.RecordingUrl || null,
      status: payload.CallStatus || 'received',
      notes: `twilio:${callId}`,
    } })
    await tx.leadEvent.create({ data: { workspaceId: asset.workspaceId, leadId: createdLead.id, type: 'RECEIVED', metadata: { source: 'CALL', provider: 'Twilio', callId, assetKey } } })
    await tx.leadEvent.create({ data: { workspaceId: asset.workspaceId, leadId: createdLead.id, type: 'CATEGORISED', metadata: { serviceCategory: 'General enquiry', urgency: 'NORMAL' } } })
    await tx.leadEvent.create({ data: { workspaceId: asset.workspaceId, leadId: createdLead.id, type: renter ? 'ASSIGNED' : 'ROUTING_FAILED', metadata: renter ? { renterId: renter.id } : { reason: 'no_matching_available_renter' } } })
    return createdLead
  })
  return { persisted: true, duplicate: false, callId, leadId: lead.id }
}

export async function updateLeadStatus(id, status) {
  const allowed = new Set(['NEW', 'NEEDS_REVIEW', 'QUALIFIED', 'ASSIGNED', 'CONTACTED', 'WON', 'LOST', 'SPAM'])
  if (!allowed.has(status)) throw new Error('invalid_status')
  const client = db()
  if (!client) return { persisted: false, id, status }
  const existing = await client.lead.findUnique({ where: { id }, include: { gmbAsset: true, assignedRenter: true } })
  if (!existing) throw new Error('lead_not_found')
  const updated = await client.$transaction(async (tx) => {
    const lead = await tx.lead.update({ where: { id }, data: { status }, include: { gmbAsset: true, assignedRenter: true } })
    await tx.leadEvent.create({ data: { workspaceId: lead.workspaceId, leadId: lead.id, type: 'STATUS_CHANGED', metadata: { from: existing.status, to: status } } })
    await tx.auditLog.create({ data: { workspaceId: lead.workspaceId, action: 'LEAD_STATUS_CHANGED', entityType: 'Lead', entityId: lead.id, before: { status: existing.status }, after: { status } } })
    return lead
  })
  return { persisted: true, lead: publicLead(updated) }
}
