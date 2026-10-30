import {cookies} from 'next/headers'
import {jwtVerify} from 'jose'
import {prisma} from '@/app/lib/prisma'
import {sessionDigest} from '@/app/lib/session-revocation'

export async function findUserOrThrow(): Promise<number> {
    const user = await findUserInternalCookie()
    if (user == null) {
        throw Error('Unauthorized')
    }
    return user
}

export async function findUserInternalCookie(): Promise<number | null> {
    if (!(await cookies()).has('access_token')) {
        return null
    }
    return findUserInternal((await cookies()).get('access_token')!.value)
}

export async function findUserInternal(token: string): Promise<number | null> {
    try {
        const {payload} = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!), {
            algorithms: ['HS256'], issuer: 'https://beijing.academy', audience: 'https://beijing.academy'
        })
        if (await prisma.sessionRevocation.findUnique({where: {tokenHash: sessionDigest(token)}})) return null
        return payload.type === 'internal' && Number.isSafeInteger(payload.seiueId) && typeof payload.exp === 'number' ? payload.seiueId as number : null
    } catch {
        return null
    }
}
