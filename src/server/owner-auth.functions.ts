import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'

const OWNER_COOKIE_NAME = 'owner_auth'
const OWNER_SESSION_DAYS = 14

function getAuthSecrets() {
  const ownerPassword = process.env.OWNER_SECTION_PASSWORD?.trim()
  const ownerSessionSecret = process.env.OWNER_SESSION_SECRET?.trim() ?? ownerPassword

  if (!ownerPassword) {
    throw new Error('OWNER_SECTION_PASSWORD is not configured')
  }

  if (!ownerSessionSecret) {
    throw new Error('OWNER_SESSION_SECRET is not configured')
  }

  return { ownerPassword, ownerSessionSecret }
}

function signValue(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function createOwnerToken(secret: string): string {
  const expiresAt = Date.now() + OWNER_SESSION_DAYS * 24 * 60 * 60 * 1000
  const payload = String(expiresAt)
  const signature = signValue(payload, secret)
  return `${payload}.${signature}`
}

function isValidOwnerToken(token: string | undefined, secret: string): boolean {
  if (!token) return false

  const parts = token.split('.')
  if (parts.length !== 2) return false

  const [payload, signature] = parts
  const expiresAt = Number(payload)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false

  const expected = signValue(payload, secret)
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== signatureBuffer.length) return false

  return timingSafeEqual(expectedBuffer, signatureBuffer)
}

function setOwnerCookie(value: string) {
  setCookie(OWNER_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OWNER_SESSION_DAYS * 24 * 60 * 60,
  })
}

export const loginOwner = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { ownerPassword, ownerSessionSecret } = getAuthSecrets()

    if (data.password !== ownerPassword) {
      throw new Error('Incorrect password')
    }

    setOwnerCookie(createOwnerToken(ownerSessionSecret))
    return { success: true }
  })

export const logoutOwner = createServerFn({ method: 'POST' }).handler(async () => {
  deleteCookie(OWNER_COOKIE_NAME, { path: '/' })
  return { success: true }
})

export const getOwnerAccess = createServerFn({ method: 'GET' }).handler(async () => {
  const { ownerSessionSecret } = getAuthSecrets()
  const token = getCookie(OWNER_COOKIE_NAME)
  return { authenticated: isValidOwnerToken(token, ownerSessionSecret) }
})
