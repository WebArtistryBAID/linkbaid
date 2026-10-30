import {createHmac, timingSafeEqual} from 'node:crypto'

export function isCredentialHash(value: string): boolean {
    return /^hmac-sha256:v1:[a-f0-9]{64}$/.test(value)
}

export function hashCredential(value: string): string {
    const pepper = process.env.CREDENTIAL_HASH_SECRET || process.env.JWT_SECRET
    if (!pepper) throw new Error('Credential hash secret is required')
    return `hmac-sha256:v1:${createHmac('sha256', pepper).update(value).digest('hex')}`
}

export function verifyCredential(supplied: string, stored: string): boolean {
    if (!isCredentialHash(stored)) return false
    const candidate = hashCredential(supplied)
    const left = Buffer.from(candidate)
    const right = Buffer.from(stored)
    return left.length === right.length && timingSafeEqual(left, right)
}
