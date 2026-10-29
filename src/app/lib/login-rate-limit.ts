import {headers} from 'next/headers'

const attempts = new Map<string, { count: number, until: number }>()

export async function allowLoginAttempt(): Promise<boolean> {
    const head = await headers()
    const key = (head.get('x-real-ip') ?? head.get('x-forwarded-for')?.split(',')[0] ?? 'unknown').slice(0, 200)
    const now = Date.now()
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key)
    const entry = attempts.get(key)
    if (entry) return ++entry.count <= 15
    if (attempts.size >= 10000) return false
    attempts.set(key, {count: 1, until: now + 60000})
    return true
}
