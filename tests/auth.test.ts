import { afterEach, describe, expect, it } from 'vitest'
import { authState, createSessionCookie, hashPassword, passwordMatches, sessionFromRequest } from '../server/auth.mjs'

const originalEnvironment = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnvironment }
})

describe('authentication', () => {
  it('hashes passwords without storing the original value', () => {
    const hash = hashPassword('correct horse battery staple')
    expect(hash).toMatch(/^scrypt\$/)
    expect(hash).not.toContain('correct horse')
    expect(passwordMatches('correct horse battery staple', hash)).toBe(true)
    expect(passwordMatches('wrong password', hash)).toBe(false)
  })

  it('signs and validates an HttpOnly session cookie', () => {
    process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-tests'
    process.env.AUTH_REQUIRED = 'true'
    const header = createSessionCookie('admin@example.com')
    const cookie = header.split(';')[0]
    const session = sessionFromRequest({ headers: { cookie } })
    expect(session?.email).toBe('admin@example.com')
    expect(authState({ headers: { cookie } })).toMatchObject({ authRequired: true, authenticated: true })
  })

  it('rejects a tampered session', () => {
    process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-tests'
    const header = createSessionCookie('admin@example.com')
    const cookie = `${header.split(';')[0]}tampered`
    expect(sessionFromRequest({ headers: { cookie } })).toBeNull()
  })
})
