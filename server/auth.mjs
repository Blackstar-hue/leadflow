import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const cookieName = 'leadflow_session'
const sessionDays = 7

export function authRequired() {
  return process.env.AUTH_REQUIRED === 'true' || process.env.NODE_ENV === 'production'
}

export function configuredAdmin() {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH && (process.env.SESSION_SECRET || '').length >= 32)
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(String(password), salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function passwordMatches(password, stored) {
  const [algorithm, salt, expectedHex] = String(stored || '').split('$')
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false
  try {
    const actual = scryptSync(String(password), salt, 64)
    const expected = Buffer.from(expectedHex, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch { return false }
}

function signature(payload) {
  return createHmac('sha256', process.env.SESSION_SECRET || '').update(payload).digest('base64url')
}

export function createSessionCookie(email) {
  const expiresAt = Date.now() + sessionDays * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ email, expiresAt })).toString('base64url')
  return `${cookieName}=${payload}.${signature(payload)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionDays * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function clearSessionCookie() {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

function cookieValue(request) {
  const cookies = String(request.headers.cookie || '').split(';').map((part) => part.trim())
  return cookies.find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1) || ''
}

export function sessionFromRequest(request) {
  const [payload, supplied] = cookieValue(request).split('.')
  if (!payload || !supplied || !process.env.SESSION_SECRET) return null
  const expected = signature(payload)
  const left = Buffer.from(supplied)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return session.expiresAt > Date.now() ? session : null
  } catch { return null }
}

export function authState(request) {
  if (!authRequired()) return { authRequired: false, authenticated: true }
  const session = sessionFromRequest(request)
  return { authRequired: true, authenticated: Boolean(session), email: session?.email }
}
