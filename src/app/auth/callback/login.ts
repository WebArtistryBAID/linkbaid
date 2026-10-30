'use server'

import {cookies, headers} from 'next/headers'
import {jwtVerify, SignJWT} from 'jose'
import {Gender, UserAuditLogType, UserType} from '@/generated/prisma/client'
import {createHash, createSecretKey, randomUUID} from 'node:crypto'
import {allowLoginAttempt} from '@/app/lib/login-rate-limit'
import {localRedirect} from '@/app/lib/redirect-target'
import {hashCredential, verifyCredential} from '@/app/lib/credential-hash'
import {prisma} from '@/app/lib/prisma'

const secret = createSecretKey(process.env.JWT_SECRET!, 'utf-8')
const feishuCallbackPath = '/auth/callback/feishu'

function appendError(target: string, error: string): string {
    return `${target}${target.includes('?') ? '&' : '?'}error=${error}`
}

function normalizeMainlandMobile(value: unknown): string {
    if (typeof value !== 'string') {
        return ''
    }
    return value.replace(/^\+86\s*/, '').replace(/\D/g, '')
}

async function getAvailableFeishuUserId(phone: string): Promise<number> {
    const digest = createHash('sha256').update(`feishu:${phone}`).digest()
    let candidate = -Math.max(1, digest.readUInt32BE(0) % 1000000000)
    while ((await prisma.user.findUnique({where: {seiueId: candidate}})) != null) {
        candidate -= 1
    }
    return candidate
}

async function issueInternalLogin(user: { seiueId: number, name: string, pinyin: string }) {
    const token = await new SignJWT({
        seiueId: user.seiueId,
        name: user.name,
        pinyin: user.pinyin,
        type: 'internal'
    })
        .setJti(randomUUID())
        .setIssuedAt()
        .setIssuer('https://beijing.academy')
        .setAudience('https://beijing.academy')
        .setExpirationTime('1 day')
        .setProtectedHeader({alg: 'HS256'})
        .sign(secret);
    (await cookies()).set('access_token', token, {
        expires: new Date(Date.now() + 86400000),
        httpOnly: true, secure: process.env.HOSTED?.startsWith('https:') === true, sameSite: 'lax', path: '/'
    })
}

export async function createFeishuState(target: string): Promise<string> {
    return await new SignJWT({
        target: localRedirect(target),
        type: 'feishu_oauth_state'
    })
        .setJti(randomUUID())
        .setIssuedAt()
        .setIssuer('https://auth.beijing.academy')
        .setAudience('https://accounts.feishu.cn')
        .setExpirationTime('10 minutes')
        .setProtectedHeader({alg: 'HS256'})
        .sign(secret)
}

async function readFeishuState(state: string | null): Promise<string | null> {
    if (state == null || (await cookies()).get('oauth_state')?.value !== createHash('sha256').update(state).digest('hex')) {
        return null
    }
    try {
        const jwt = await jwtVerify(state, secret, {
            algorithms: ['HS256'],
            issuer: 'https://auth.beijing.academy',
            audience: 'https://accounts.feishu.cn'
        })
        if (jwt.payload.type !== 'feishu_oauth_state') {
            return null
        }
        (await cookies()).delete('oauth_state')
        return localRedirect(jwt.payload.target)
    } catch {
        return null
    }
}

export async function loginWithAccessCode(code: string): Promise<boolean> {
    if (!await allowLoginAttempt(typeof code === 'string' ? code : undefined)) return false
    const head = await headers()
    const ip = head.get('X-Forwarded-For') ?? head.get('X-Real-IP') ?? 'localhost'
    if (typeof code !== 'string' || code.length < 1 || code.length > 512 || code.startsWith('oauth:')) {
        return false
    }
    const access = await prisma.accessCode.findFirst({
        where: {
            code: hashCredential(code)
        }
    })
    if (access == null || !verifyCredential(code, access.code)) {
        return false
    }
    const user = await prisma.user.findUnique({
        where: {
            seiueId: access.userId
        }
    })
    if (user == null) {
        return false
    }
    if (!access.persistent) {
        const consumed = await prisma.accessCode.deleteMany({where: {id: access.id, persistent: false}})
        if (consumed.count !== 1) return false
    }
    await prisma.userAuditLog.create({
        data: {
            userId: user.seiueId,
            type: UserAuditLogType.logIn,
            values: [head.get('User-Agent') ?? '', ip]
        }
    })
    await issueInternalLogin(user)
    return true
}

export async function loginWithFeishu(code: string | null, state: string | null): Promise<string> {
    const head = await headers()
    const ip = head.get('X-Forwarded-For') ?? head.get('X-Real-IP') ?? 'localhost'
    if (!await allowLoginAttempt()) return '/auth?error=feishu'
    const target = await readFeishuState(state)
    if (target == null || code == null || code.length < 1) {
        return appendError(target ?? '/', 'feishu')
    }

    const redirectURI = `${process.env.HOSTED}${feishuCallbackPath}`
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: process.env.FEISHU_APP_ID,
            client_secret: process.env.FEISHU_APP_SECRET,
            code,
            redirect_uri: redirectURI
        }),
        signal: AbortSignal.timeout(15000),
        cache: 'no-store'
    })
    if (!tokenResponse.ok) {
        return appendError(target, 'feishu')
    }
    const tokenJson = await tokenResponse.json()
    if (tokenJson.code !== 0) {
        return appendError(target, 'feishu')
    }
    const accessToken = tokenJson.access_token ?? tokenJson.data?.access_token
    if (typeof accessToken !== 'string' || accessToken.length < 1) {
        return appendError(target, 'feishu')
    }

    const userInfoResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=utf-8'
        },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store'
    })
    if (!userInfoResponse.ok) {
        return appendError(target, 'feishu')
    }
    const userInfoJson = await userInfoResponse.json()
    if (userInfoJson.code !== 0) {
        return appendError(target, 'feishu')
    }

    const feishuUser = userInfoJson.data ?? {}
    const phone = normalizeMainlandMobile(feishuUser.mobile)
    if (!/^1[3-9]\d{9}$/.test(phone)) {
        return appendError(target, 'feishu')
    }

    let user = await prisma.user.findFirst({
        where: {
            phone
        }
    })

    if (user == null) {
        user = await prisma.user.create({
            data: {
                seiueId: await getAvailableFeishuUserId(phone),
                name: feishuUser.name ?? feishuUser.en_name ?? phone,
                schoolId: `feishu:${phone}`,
                pinyin: feishuUser.en_name ?? '',
                phone,
                adminClass0: '',
                classTeacher0: '',
                gender: Gender.others,
                lastUserAgent: head.get('User-Agent') ?? '',
                type: UserType.teacher
            }
        })
        await prisma.userAuditLog.create({
            data: {
                userId: user.seiueId,
                type: UserAuditLogType.created,
                values: [head.get('User-Agent') ?? '', ip]
            }
        })
    } else {
        await prisma.userAuditLog.create({
            data: {
                userId: user.seiueId,
                type: UserAuditLogType.logIn,
                values: [head.get('User-Agent') ?? '', ip]
            }
        })
    }

    await issueInternalLogin(user)
    return target
}

export default async function login(error: boolean | null, tok: string | null, target: string, state?: string | null): Promise<string> {
    const head = await headers()
    const ip = head.get('X-Forwarded-For') ?? head.get('X-Real-IP') ?? 'localhost'

    if (!await allowLoginAttempt()) return '/auth?error=seiue'
    target = localRedirect(target)
    const stateTarget = await readFeishuState(state ?? null)
    if (stateTarget == null || stateTarget !== target) return '/auth?error=seiue'
    if (typeof tok !== 'string' || tok.length < 1 || tok.length > 16384) return '/auth?error=seiue'

    if (error) {
        return target + '?error=seiue'
    }

    const r = await fetch('https://open.seiue.com/api/v3/oauth/me',
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${tok}`,
                'X-School-Id': '452'
            },
            signal: AbortSignal.timeout(15000),
            cache: 'no-store'
        }
    )

    if (!r.ok) {
        return target + '?error=build'
    }
    const json = await r.json()
    let user = await prisma.user.findUnique({
        where: {
            seiueId: json['id']
        }
    })

    if (json['role'] === 'guardian') {
        return '/auth/parent'
    }

    const userData = {
        seiueId: json['id'],
        name: json['name'],
        schoolId: json['usin'],
        pinyin: json['pinyin'] ?? '',
        phone: json['phone'],
        adminClass0: (json['admin_classes'] == null || json['admin_classes'].length < 1) ? '' : json['admin_classes'][0],
        classTeacher0: (json['class_teachers'] == null || json['class_teachers'].length < 1) ? '' : json['class_teachers'][0],
        gender: (json['gender'] === 'm' ? Gender.male : (json['gender'] === 'f' ? Gender.female : Gender.others)),
        lastUserAgent: head.get('User-Agent') ?? '',
        type: json['role'] === 'student' ? UserType.student : UserType.teacher
    }

    if (user == null) {
        user = await prisma.user.create({
            data: userData
        })
        await prisma.userAuditLog.create({
            data: {
                userId: user.seiueId,
                type: UserAuditLogType.created,
                values: [head.get('User-Agent') ?? '', ip]
            }
        })
    } else {
        await prisma.user.update({
            data: userData,
            where: {
                seiueId: json['id']
            }
        })
        await prisma.userAuditLog.create({
            data: {
                userId: user.seiueId,
                type: UserAuditLogType.logIn,
                values: [head.get('User-Agent') ?? '', ip]
            }
        })
    }


    await issueInternalLogin(user)

    return target as string
}
