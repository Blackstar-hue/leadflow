import { timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import twilio from 'twilio'
import { databaseEnabled, databaseHealthy, recordWebhookEvent, listAssets, listLeads, listRenters, createRenter, listRoutingRules, createWebsiteLead, recordCall, updateLeadStatus } from './store.mjs'
import { authRequired, configuredAdmin, passwordMatches, createSessionCookie, clearSessionCookie, sessionFromRequest, authState } from './auth.mjs'

const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || '0.0.0.0'
const demoMode = process.env.DEMO_MODE === 'true'
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const publicRoot = join(projectRoot, 'dist')
const composioEvents = new Set()
const rateBuckets = new Map()

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }

function securityHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  }
}

function send(res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(status, { ...securityHeaders(), 'content-type': type, 'cache-control': 'no-store', ...extra })
  res.end(body)
}

function json(res, status, body, type = 'application/json; charset=utf-8', extra = {}) { send(res, status, JSON.stringify(body), type, extra) }

function requireSession(request, response) {
  if (!authRequired() || sessionFromRequest(request)) return true
  json(response, 401, { ok: false, error: 'Authentication required' })
  return false
}

function sameOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return true
  try {
    const expected = new URL(process.env.PUBLIC_APP_URL || `http://${request.headers.host || 'localhost'}`)
    return new URL(origin).origin === expected.origin
  } catch { return false }
}

function requireSameOrigin(request, response) {
  if (sameOrigin(request)) return true
  json(response, 403, { ok: false, error: 'Origin not allowed' })
  return false
}

function safeEqual(left, right) {
  const a = Buffer.from(left || '')
  const b = Buffer.from(right || '')
  return a.length === b.length && timingSafeEqual(a, b)
}

function rateLimited(ip, limit = 30) {
  const now = Date.now()
  const current = rateBuckets.get(ip) || { count: 0, started: now }
  if (now - current.started > 60_000) {
    rateBuckets.set(ip, { count: 1, started: now })
    return false
  }
  current.count += 1
  rateBuckets.set(ip, current)
  return current.count > limit
}

function normalise(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function sourceKeyFor(assetKey) {
  try { return JSON.parse(process.env.SOURCE_KEYS_JSON || '{}')[assetKey] } catch { return undefined }
}

function assetForTwilioNumber(number) {
  try { return JSON.parse(process.env.TWILIO_NUMBER_ASSETS_JSON || '{}')[number] } catch { return undefined }
}

async function requestBody(request) {
  let text = ''
  for await (const chunk of request) {
    text += chunk
    if (text.length > 64_000) throw new Error('payload too large')
  }
  const type = String(request.headers['content-type'] || '')
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text))
  return JSON.parse(text || '{}')
}

function mapFormPayload(payload) {
  return {
    name: normalise(payload.name || [payload.first_name, payload.last_name].filter(Boolean).join(' '), 120),
    phone: normalise(payload.phone || payload.telephone, 40),
    email: normalise(payload.email, 254),
    message: normalise(payload.message || payload.service_requirement || payload.enquiry, 500),
    service: normalise(payload.service || payload.service_category, 160),
    idempotencyKey: normalise(payload.idempotency_key || payload.idempotencyKey, 200),
    honeypot: normalise(payload.website || payload.company_website, 200),
    metadata: payload,
  }
}

function twilioSignatureIsValid(request, url, params) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = request.headers['x-twilio-signature']
  if (!authToken || !signature) return process.env.NODE_ENV !== 'production' && process.env.TWILIO_VALIDATE_SIGNATURES !== 'true'
  try { return twilio.validateRequest(authToken, String(signature), url, params) } catch { return false }
}

function composioRequestIsValid(request) {
  const secret = process.env.COMPOSIO_WEBHOOK_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const supplied = request.headers['x-composio-signature'] || request.headers['x-composio-webhook-secret'] || request.headers.authorization?.replace(/^Bearer\s+/i, '')
  return safeEqual(String(supplied || ''), secret)
}

function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function leadsCsv(leads) {
  const columns = ['id', 'received', 'name', 'phone', 'email', 'service', 'summary', 'urgency', 'quality', 'status', 'website', 'assetId', 'renter', 'source']
  return `${columns.join(',')}\n${leads.map((lead) => columns.map((column) => csvCell(lead[column])).join(',')).join('\n')}\n`
}

function xmlEscape(value) { return String(value).replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char])) }

function twimlResponse(res) {
  const forwardTo = process.env.TWILIO_FORWARD_TO
  const xml = forwardTo
    ? `<Response><Dial>${xmlEscape(forwardTo)}</Dial></Response>`
    : '<Response><Say>Thank you. This phone connection is not configured for forwarding yet.</Say><Hangup/></Response>'
  send(res, 200, xml, 'text/xml; charset=utf-8')
}

async function serveStatic(url, response) {
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/' || !extname(pathname)) pathname = '/index.html'
  const candidate = normalize(join(publicRoot, pathname))
  if (!candidate.startsWith(publicRoot)) return send(response, 404, 'Not found', 'text/plain; charset=utf-8')
  try {
    const info = await stat(candidate)
    if (!info.isFile()) throw new Error('not a file')
    const data = await readFile(candidate)
    const type = contentTypes[extname(candidate).toLowerCase()] || 'application/octet-stream'
    return send(response, 200, data, type, { 'cache-control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' })
  } catch {
    return send(response, 404, 'Not found', 'text/plain; charset=utf-8')
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  if (request.method === 'OPTIONS') return send(response, 204, '')
  if (url.pathname === '/healthz' && request.method === 'GET') {
    const dbReady = databaseEnabled() ? await databaseHealthy() : false
    const ready = process.env.NODE_ENV !== 'production' || (dbReady && configuredAdmin())
    return json(response, ready ? 200 : 503, { ok: ready, service: 'leadflow', demoMode, databaseConfigured: databaseEnabled(), databaseHealthy: dbReady, authConfigured: configuredAdmin(), persistenceMode: databaseEnabled() ? 'postgresql' : 'memory-fallback', callWebhookConfigured: Boolean(process.env.TWILIO_AUTH_TOKEN) })
  }

  const ip = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown'
  if (url.pathname.startsWith('/api/') && rateLimited(ip)) return json(response, 429, { ok: false, error: 'Please try again later' })

  if (url.pathname === '/api/auth/me' && request.method === 'GET') return json(response, 200, authState(request))

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    if (!authRequired()) return json(response, 200, { ok: true, ...authState(request) })
    if (!configuredAdmin()) return json(response, 503, { ok: false, error: 'Admin authentication is not configured' })
    try {
      const payload = await requestBody(request)
      const email = normalise(payload.email, 254).toLowerCase()
      const password = String(payload.password || '')
      if (email !== String(process.env.ADMIN_EMAIL).toLowerCase() || !passwordMatches(password, process.env.ADMIN_PASSWORD_HASH)) return json(response, 401, { ok: false, error: 'Email or password is incorrect' })
      return json(response, 200, { ok: true, authRequired: true, authenticated: true, email }, 'application/json; charset=utf-8', { 'set-cookie': createSessionCookie(email) })
    } catch { return json(response, 400, { ok: false, error: 'Unable to sign in' }) }
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    if (!requireSameOrigin(request, response)) return
    return json(response, 200, { ok: true }, 'application/json; charset=utf-8', { 'set-cookie': clearSessionCookie() })
  }

  if (url.pathname === '/api/v1/assets' && request.method === 'GET') {
    if (!requireSession(request, response)) return
    try { return json(response, 200, await listAssets()) }
    catch (error) { console.error('assets_read_failed', error); return json(response, 503, { ok: false, error: 'Assets are temporarily unavailable' }) }
  }

  if (url.pathname === '/api/v1/leads' && request.method === 'GET') {
    if (!requireSession(request, response)) return
    try { return json(response, 200, await listLeads()) }
    catch (error) { console.error('leads_read_failed', error); return json(response, 503, { ok: false, error: 'Leads are temporarily unavailable' }) }
  }

  if (url.pathname === '/api/v1/leads/export.csv' && request.method === 'GET') {
    if (!requireSession(request, response)) return
    try {
      const csv = leadsCsv(await listLeads())
      return send(response, 200, csv, 'text/csv; charset=utf-8', { 'content-disposition': 'attachment; filename="leadflow-leads.csv"' })
    } catch (error) { console.error('leads_export_failed', error); return json(response, 503, { ok: false, error: 'Export is temporarily unavailable' }) }
  }

  if (url.pathname === '/api/v1/renters' && request.method === 'GET') {
    if (!requireSession(request, response)) return
    try { return json(response, 200, await listRenters()) }
    catch (error) { console.error('renters_read_failed', error); return json(response, 503, { ok: false, error: 'Renters are temporarily unavailable' }) }
  }

  if (url.pathname === '/api/v1/renters' && request.method === 'POST') {
    if (!requireSameOrigin(request, response) || !requireSession(request, response)) return
    try { return json(response, 201, { ok: true, renter: await createRenter(await requestBody(request)) }) }
    catch (error) {
      const status = error?.message === 'invalid_renter' ? 400 : 503
      return json(response, status, { ok: false, error: status === 400 ? 'Please provide a renter name' : 'Unable to create renter' })
    }
  }

  if (url.pathname === '/api/v1/routing/rules' && request.method === 'GET') {
    if (!requireSession(request, response)) return
    try { return json(response, 200, await listRoutingRules()) }
    catch (error) { console.error('routing_rules_read_failed', error); return json(response, 503, { ok: false, error: 'Routing rules are temporarily unavailable' }) }
  }

  const leadMatch = url.pathname.match(/^\/api\/v1\/leads\/([^/]+)$/)
  if (leadMatch && request.method === 'PATCH') {
    if (!requireSameOrigin(request, response)) return
    if (!requireSession(request, response)) return
    try {
      const payload = await requestBody(request)
      const result = await updateLeadStatus(decodeURIComponent(leadMatch[1]), normalise(payload.status, 40).toUpperCase().replace(/ /g, '_'))
      return json(response, 200, { ok: true, persisted: result.persisted, lead: result.lead })
    } catch (error) {
      const status = error?.message === 'lead_not_found' ? 404 : error?.message === 'invalid_status' ? 400 : 503
      return json(response, status, { ok: false, error: status === 503 ? 'Unable to update lead' : error.message })
    }
  }

  const formMatch = url.pathname.match(/^\/api\/v1\/intake\/forms\/([^/]+)$/)
  if (formMatch && request.method === 'POST') {
    if (process.env.NODE_ENV === 'production' && !databaseEnabled()) return json(response, 503, { ok: false, error: 'Lead intake is temporarily unavailable' })
    const assetKey = decodeURIComponent(formMatch[1])
    const expectedKey = sourceKeyFor(assetKey)
    const providedKey = request.headers['x-source-key'] || request.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!expectedKey || !safeEqual(String(providedKey || ''), String(expectedKey))) return json(response, 401, { ok: false, error: 'Unable to accept this submission' })
    try {
      const payload = mapFormPayload(await requestBody(request))
      if (payload.honeypot) return json(response, 202, { ok: true, accepted: true })
      if (payload.name.length < 2 || payload.phone.length < 7 || payload.message.length < 3) return json(response, 400, { ok: false, error: 'Please check the required fields' })
      const result = await createWebsiteLead(assetKey, payload)
      return json(response, 202, { ok: true, accepted: true, duplicate: result.duplicate, persisted: result.persisted, leadId: demoMode ? result.lead.id : undefined })
    } catch (error) {
      console.error('intake_rejected', { reason: error instanceof Error ? error.message : 'invalid payload' })
      return json(response, 400, { ok: false, error: 'Unable to accept this submission' })
    }
  }

  if (url.pathname === '/api/v1/intake/calls/twilio' && request.method === 'POST') {
    if (process.env.NODE_ENV === 'production' && !databaseEnabled()) return send(response, 503, 'Service unavailable', 'text/plain; charset=utf-8')
    try {
      const payload = await requestBody(request)
      const publicUrl = `${process.env.PUBLIC_APP_URL || `https://${request.headers.host}`}${url.pathname}`
      if (!twilioSignatureIsValid(request, publicUrl, payload)) return send(response, 403, 'Forbidden', 'text/plain; charset=utf-8')
      const assetKey = assetForTwilioNumber(normalise(payload.To, 40))
      const callId = normalise(payload.CallSid || payload.call_sid, 64)
      if (!callId) return send(response, 400, 'Bad request', 'text/plain; charset=utf-8')
      const result = await recordCall(payload, assetKey)
      twimlResponse(response)
      console.log('twilio_call_received', { callId: result.callId, duplicate: result.duplicate })
      return
    } catch (error) {
      console.error('twilio_call_rejected', { reason: error instanceof Error ? error.message : 'invalid payload' })
      return send(response, 400, 'Bad request', 'text/plain; charset=utf-8')
    }
  }

  if (url.pathname === '/api/v1/intake/calls/twilio/status' && request.method === 'POST') {
    if (process.env.NODE_ENV === 'production' && !databaseEnabled()) return json(response, 503, { ok: false, error: 'Call intake is temporarily unavailable' })
    try {
      const payload = await requestBody(request)
      const publicUrl = `${process.env.PUBLIC_APP_URL || `https://${request.headers.host}`}${url.pathname}`
      if (!twilioSignatureIsValid(request, publicUrl, payload)) return send(response, 403, 'Forbidden', 'text/plain; charset=utf-8')
      const assetKey = assetForTwilioNumber(normalise(payload.To, 40))
      const result = await recordCall(payload, assetKey)
      return json(response, 202, { ok: true, ...result })
    } catch (error) {
      console.error('twilio_status_rejected', { reason: error instanceof Error ? error.message : 'invalid payload' })
      return json(response, 400, { ok: false, error: 'Unable to accept callback' })
    }
  }

  if (url.pathname === '/api/v1/intake/composio' && request.method === 'POST') {
    if (process.env.NODE_ENV === 'production' && !databaseEnabled()) return json(response, 503, { ok: false, error: 'Webhook intake is temporarily unavailable' })
    if (!composioRequestIsValid(request)) return json(response, 403, { ok: false, error: 'Forbidden' })
    try {
      const payload = await requestBody(request)
      const eventId = normalise(payload.id || payload.event_id || payload.log_id, 120)
      if (eventId) {
        const result = await recordWebhookEvent('composio', eventId, payload)
        if (result.persisted && result.duplicate) return json(response, 202, { ok: true, duplicate: true })
        if (!result.persisted && composioEvents.has(eventId)) return json(response, 202, { ok: true, duplicate: true })
        if (!result.persisted) composioEvents.add(eventId)
      }
      return json(response, 202, { ok: true, accepted: true, eventId: eventId || undefined })
    } catch {
      return json(response, 400, { ok: false, error: 'Unable to accept event' })
    }
  }

  if (url.pathname.startsWith('/api/')) return json(response, 404, { ok: false, error: 'Not found' })
  if (request.method === 'GET') return serveStatic(url, response)
  return json(response, 405, { ok: false, error: 'Method not allowed' })
})

server.listen(port, host, () => console.log(`Leadflow listening on http://${host}:${port}`))
