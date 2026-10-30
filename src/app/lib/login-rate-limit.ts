import {headers} from 'next/headers'
import {isIP} from 'node:net'
import {hashCredential} from '@/app/lib/credential-hash'
import {prisma} from '@/app/lib/prisma'

async function consume(key: string, limit: number): Promise<boolean> {
    const rows = await prisma.$queryRaw<{ attempts: number }[]>`
        INSERT INTO "LoginRateLimit" ("key", "attempts", "windowEnd")
        VALUES (${key}, 1, NOW() + INTERVAL '1 minute')
        ON CONFLICT ("key") DO UPDATE SET
            "attempts" = CASE WHEN "LoginRateLimit"."windowEnd" <= NOW()
                THEN 1 ELSE LEAST("LoginRateLimit"."attempts" + 1, ${limit + 1}) END,
            "windowEnd" = CASE WHEN "LoginRateLimit"."windowEnd" <= NOW()
                THEN NOW() + INTERVAL '1 minute' ELSE "LoginRateLimit"."windowEnd" END
        RETURNING "attempts"
    `
    return rows[0].attempts <= limit
}

export async function allowLoginAttempt(credential?: string): Promise<boolean> {
    try {
        if (!await consume('login:global', 300)) return false
        const head = await headers()
        const trustedHeader = process.env.TRUSTED_CLIENT_IP_HEADER
        const ip = trustedHeader ? head.get(trustedHeader)?.trim() : null
        if (ip && isIP(ip) && !await consume(`login:ip:${ip}`, 15)) return false
        if (typeof credential === 'string' && credential.length <= 512) {
            const digest = hashCredential(credential)
            if (!await consume(`login:credential:${digest}`, 15)) return false
        }
        await prisma.loginRateLimit.deleteMany({where: {windowEnd: {lt: new Date(Date.now() - 60000)}}})
        return true
    } catch {
        return false
    }
}
