import {createHash} from 'node:crypto'
import {jwtVerify} from 'jose'
import {prisma} from '@/app/lib/prisma'

export function sessionDigest(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export async function revokeSession(token: string): Promise<void> {
    let expiresAt: Date
    try {
        const {payload} = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!), {
            algorithms: ['HS256'], issuer: 'https://beijing.academy', audience: 'https://beijing.academy'
        })
        if (payload.type !== 'internal' || typeof payload.exp !== 'number') return
        expiresAt = new Date(payload.exp * 1000)
    } catch {
        return
    }
    await prisma.sessionRevocation.upsert({
        where: {tokenHash: sessionDigest(token)},
        create: {tokenHash: sessionDigest(token), expiresAt},
        update: {expiresAt}
    })
    await prisma.sessionRevocation.deleteMany({where: {expiresAt: {lt: new Date()}}})
}
