'use server'

import {ApprovalStatus, Authorization, Scope} from '@/generated/prisma/client'
import {getMe} from '@/app/lib/user-actions'
import {createHash, createSecretKey, randomUUID} from 'node:crypto'
import {jwtVerify, SignJWT} from 'jose'
import {getAppByID, verifyAppSecretByID} from '@/app/lib/app-actions'
import {findUserOrThrow} from '@/app/lib/utils'
import {NextRequest} from 'next/server'
import {prisma} from '@/app/lib/prisma'

const secret = createSecretKey(process.env.JWT_SECRET!, 'utf-8')

export async function authorizeForCode(application: number, scopes: Scope[], state: string | null, redirectURI: string, includePhone: boolean = false): Promise<string | null> {
    const me = await getMe()
    if (!me) {
        return null
    }
    const app = await prisma.application.findFirst({
        where: {
            id: application
        }
    })
    if (!app || (app.accessGated && app.ownerId !== me.seiueId && !app.allowedUsers.includes(me.seiueId))) {
        return null
    }

    if (app.approved !== ApprovalStatus.approved && app.ownerId !== me.seiueId) {
        return null
    }
    if (!scopes.every(s => app.scopes.includes(s))) {
        return null
    }
    let destination: URL
    try {
        destination = new URL(redirectURI)
    } catch {
        return null
    }
    if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password || destination.hash || !app.redirectUrls.includes(redirectURI)) {
        return null
    }

    const code = await new SignJWT({
        user: me.seiueId,
        app: app.id,
        scopes: scopes.map(s => s.toString()),
        state: state,
        phone: includePhone && scopes.includes('phone') ? (me.phone == null ? null : `+86${me.phone}`) : null,
        redirectURI,
        type: 'authorization_code'
    })
        .setJti(randomUUID())
        .setIssuedAt()
        .setIssuer('https://auth.beijing.academy')
        .setAudience(app.redirectUrls[0])
        .setExpirationTime('5 minutes')
        .setProtectedHeader({alg: 'HS256'})
        .sign(secret)
    await prisma.accessCode.deleteMany({
        where: {
            code: {startsWith: 'oauth:'},
            createdAt: {lt: new Date(Date.now() - 5 * 60 * 1000)}
        }
    })
    await prisma.accessCode.create({
        data: {
            userId: me.seiueId,
            code: `oauth:${createHash('sha256').update(code).digest('hex')}`,
            persistent: false
        }
    })
    return code
}

export interface TokenResponse {
    access_token: string
    token_type: 'Bearer'
    expires_in: number
    refresh_token: string
}

export interface TokenErrorResponse {
    error: string
    error_description: string
}

export async function authorizeForTokens(code: string, credentials: string, grantType: string, redirectURI: string): Promise<TokenResponse | TokenErrorResponse> {
    if (grantType !== 'authorization_code') {
        return {
            error: 'unsupported_grant_type',
            error_description: 'The provided grant type is not supported.'
        }
    }

    const cred = Buffer.from(typeof credentials === 'string' ? credentials : '', 'base64').toString('utf-8').split(':')

    if (cred.length !== 2) {
        return {
            error: 'invalid_client',
            error_description: 'The client credentials are invalid.'
        }
    }

    let jwt
    try {
        jwt = await jwtVerify(code, secret, {algorithms: ['HS256'], issuer: 'https://auth.beijing.academy'})
    } catch {
        return {
            error: 'invalid_grant',
            error_description: 'The provided authorization code is invalid or has expired.'
        }
    }

    if (!validPayload(jwt.payload) || jwt.payload.type !== 'authorization_code') {
        return {
            error: 'invalid_grant',
            error_description: 'The provided authorization code is invalid or has expired.'
        }
    }

    if (jwt.payload.redirectURI !== redirectURI) {
        return {
            error: 'invalid_grant',
            error_description: 'The provided redirect URI does not match the one used to generate the authorization code.'
        }
    }

    const app = await getAppByID(jwt.payload.app as number)
    if (app == null || app.approved !== ApprovalStatus.approved) {
        return {
            error: 'invalid_grant',
            error_description: 'The provided authorization code is invalid or has expired.'
        }
    }

    if (cred[0] !== app.clientId || !(await verifyAppSecretByID(app.id!, cred[1]))) {
        return {
            error: 'invalid_client',
            error_description: 'The client credentials are invalid.'
        }
    }

    const currentApp = await prisma.application.findUnique({where: {id: app.id}})
    if (!currentApp || !currentApp.redirectUrls.includes(redirectURI) || !(jwt.payload.scopes as string[]).every(scope => currentApp.scopes.includes(scope as Scope)) || (currentApp.accessGated && currentApp.ownerId !== jwt.payload.user && !currentApp.allowedUsers.includes(jwt.payload.user as number))) {
        return {error: 'invalid_grant', error_description: 'The authorization is unavailable.'}
    }
    const authorizationId = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 AS locked
                           FROM pg_advisory_xact_lock(${jwt.payload.user as number}::int, ${app.id}::int)`
        const consumed = await tx.accessCode.deleteMany({
            where: {
                userId: jwt.payload.user as number,
                persistent: false,
                code: `oauth:${createHash('sha256').update(code).digest('hex')}`
            }
        })
        if (consumed.count !== 1) return null
        let grant = await tx.authorization.findFirst({
            where: {userId: jwt.payload.user as number, applicationId: app.id},
            orderBy: {id: 'asc'}
        })
        if (grant) {
            grant = await tx.authorization.update({
                where: {id: grant.id},
                data: {scopes: jwt.payload.scopes as string[]}
            })
        } else {
            grant = await tx.authorization.create({
                data: {
                    userId: jwt.payload.user as number, applicationId: app.id, scopes: jwt.payload.scopes as string[]
                }
            })
        }
        await tx.appAuditLog.create({
            data: {
                type: 'authorizedUser', applicationId: app.id,
                operationUserId: jwt.payload.user as number, values: jwt.payload.scopes as string[]
            }
        })
        await tx.userAuditLog.create({
            data: {
                type: 'authorizedApp', userId: jwt.payload.user as number, values: [app.id.toString()]
            }
        })
        return grant.id
    })
    if (authorizationId == null) return {
        error: 'invalid_grant', error_description: 'The authorization code has already been used or expired.'
    }

    const accessToken = await new SignJWT({
        user: jwt.payload.user,
        authorizationId,
        app: jwt.payload.app,
        scopes: jwt.payload.scopes,
        type: 'access_token'
    })
        .setIssuedAt()
        .setIssuer('https://access.beijing.academy')
        .setAudience(redirectURI)
        .setExpirationTime('1 day')
        .setProtectedHeader({alg: 'HS256'})
        .sign(secret)
    const refreshToken = await new SignJWT({
        user: jwt.payload.user,
        authorizationId,
        app: jwt.payload.app,
        scopes: jwt.payload.scopes,
        type: 'refresh_token'
    })
        .setIssuedAt()
        .setIssuer('https://refresh.beijing.academy')
        .setAudience(redirectURI)
        .setExpirationTime('30 days')
        .setProtectedHeader({alg: 'HS256'})
        .sign(secret)
    return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
        refresh_token: refreshToken
    }
}

export async function refreshToken(refreshToken: string, credentials: string, grantType: string, scope: string[] | null): Promise<TokenResponse | TokenErrorResponse> {
    if (grantType !== 'refresh_token') {
        return {
            error: 'unsupported_grant_type',
            error_description: 'The provided grant type is not supported.'
        }
    }

    const cred = Buffer.from(typeof credentials === 'string' ? credentials : '', 'base64').toString('utf-8').split(':')

    if (cred.length !== 2) {
        return {
            error: 'invalid_client',
            error_description: 'The client credentials are invalid.'
        }
    }

    let jwt
    try {
        jwt = await jwtVerify(refreshToken, secret, {algorithms: ['HS256'], issuer: 'https://refresh.beijing.academy'})
    } catch {
        return {
            error: 'invalid_grant',
            error_description: 'The provided refresh token is invalid or has expired.'
        }
    }

    if (!validPayload(jwt.payload) || jwt.payload.type !== 'refresh_token') {
        return {
            error: 'invalid_grant',
            error_description: 'The provided refresh token is invalid or has expired.'
        }
    }

    const authorization = await findTokenAuthorization(jwt.payload)
    if (authorization == null) {
        return {
            error: 'invalid_grant',
            error_description: 'The provided refresh token is invalid or has expired.'
        }
    }
    if (!(jwt.payload.scopes as string[]).every(s => authorization.scopes.includes(s))) {
        return {
            error: 'invalid_grant',
            error_description: 'The provided refresh token is invalid or has expired.'
        }
    }

    const app = await prisma.application.findFirst({
        where: {
            id: jwt.payload.app as number
        }
    })

    if (app == null || app.approved !== ApprovalStatus.approved || (app.accessGated && app.ownerId !== jwt.payload.user && !app.allowedUsers.includes(jwt.payload.user as number)) || !(jwt.payload.scopes as string[]).every(s => app.scopes.includes(s as Scope))) {
        return {
            error: 'invalid_grant',
            error_description: 'The provided refresh token is invalid or has expired.'
        }
    }

    if (cred[0] !== app.clientId || !(await verifyAppSecretByID(app.id!, cred[1]))) {
        return {
            error: 'invalid_client',
            error_description: 'The client credentials are invalid.'
        }
    }

    if (scope == null) {
        const accessToken = await new SignJWT({
            user: jwt.payload.user,
            authorizationId: authorization.id,
            app: jwt.payload.app,
            scopes: jwt.payload.scopes,
            type: 'access_token'
        })
            .setIssuedAt()
            .setIssuer('https://access.beijing.academy')
            .setAudience(app.redirectUrls[0])
            .setExpirationTime('1 day')
            .setProtectedHeader({alg: 'HS256'})
            .sign(secret)
        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 86400,
            refresh_token: refreshToken
        }
    }
    if (!scope.every(s => (jwt.payload.scopes as string[]).includes(s))) {
        return {
            error: 'invalid_scope',
            error_description: 'The provided scopes are invalid.'
        }
    }
    const accessToken = await new SignJWT({
        user: jwt.payload.user,
        authorizationId: authorization.id,
        app: jwt.payload.app,
        scopes: scope,
        type: 'access_token'
    })
        .setIssuedAt()
        .setIssuer('https://access.beijing.academy')
        .setAudience(app.redirectUrls[0])
        .setExpirationTime('1 day')
        .setProtectedHeader({alg: 'HS256'})
        .sign(secret)
    const refreshTokenNew = await new SignJWT({
        user: jwt.payload.user,
        authorizationId: authorization.id,
        app: jwt.payload.app,
        scopes: scope,
        type: 'refresh_token'
    })
        .setIssuedAt()
        .setIssuer('https://refresh.beijing.academy')
        .setAudience(app.redirectUrls[0])
        .setExpirationTime('30 days')
        .setProtectedHeader({alg: 'HS256'})
        .sign(secret)
    return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
        refresh_token: refreshTokenNew
    }
}

export async function revokeToken(token: string, credentials: string): Promise<boolean> {
    const cred = Buffer.from(typeof credentials === 'string' ? credentials : '', 'base64').toString('utf-8').split(':')

    if (cred.length !== 2) {
        return false
    }

    let jwt
    try {
        jwt = await jwtVerify(token, secret, {
            algorithms: ['HS256'],
            issuer: ['https://access.beijing.academy', 'https://refresh.beijing.academy']
        })
    } catch {
        return false
    }

    if (!validPayload(jwt.payload) || (jwt.payload.type !== 'access_token' && jwt.payload.type !== 'refresh_token')) {
        return false
    }

    const app = await getAppByID(jwt.payload.app as number)
    if (app == null) {
        return false
    }

    if (cred[0] !== app.clientId || !(await verifyAppSecretByID(app.id!, cred[1]))) {
        return false
    }

    await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 AS locked
                           FROM pg_advisory_xact_lock(${jwt.payload.user as number}::int, ${app.id}::int)`
        const grant = await findTokenAuthorization(jwt.payload, tx)
        if (!grant) return
        await tx.authorization.deleteMany({where: {id: grant.id, userId: grant.userId}})
        await tx.userAuditLog.create({
            data: {
                type: 'deauthorizedApp', userId: grant.userId, values: [app.id.toString()]
            }
        })
    })
    return true
}

export async function revokeMyAuthorization(auth: Authorization): Promise<void> {
    const userId = await findUserOrThrow()
    const grant = await prisma.authorization.findFirst({where: {id: auth.id, userId}})
    if (!grant) return
    await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 AS locked
                           FROM pg_advisory_xact_lock(${userId}::int, ${grant.applicationId}::int)`
        const removed = await tx.authorization.deleteMany({where: {id: grant.id, userId}})
        if (removed.count === 0) return
        await tx.userAuditLog.create({
            data: {
                type: 'deauthorizedApp', userId, values: [grant.applicationId.toString()]
            }
        })
    })
}

export async function getUserIDFromHeader(request: NextRequest): Promise<number | null> {
    const auth = request.headers.get('Authorization')
    if (auth == null || !auth.startsWith('Bearer ')) {
        return null
    }

    try {
        const jwt = await jwtVerify(auth.slice(7), secret, {
            algorithms: ['HS256'],
            issuer: 'https://access.beijing.academy'
        })
        if (!await validateAccessToken(auth.slice(7), [])) return null
        return jwt.payload.user as number
    } catch {
        return null
    }
}

export async function validateFromHeader(request: NextRequest, scope: string[]): Promise<boolean> {
    const auth = request.headers.get('Authorization')
    if (auth == null || !auth.startsWith('Bearer ')) {
        return false
    }

    return await validateAccessToken(auth.replace('Bearer ', ''), scope)
}

export async function validateAccessToken(accessToken: string, scope: string[]): Promise<boolean> {
    try {
        const jwt = await jwtVerify(accessToken, secret, {
            algorithms: ['HS256'],
            issuer: 'https://access.beijing.academy'
        })

        if (!validPayload(jwt.payload) || jwt.payload.type !== 'access_token') {
            return false
        }

        const authorization = await findTokenAuthorization(jwt.payload)
        if (authorization == null) {
            return false
        }
        const app = await prisma.application.findUnique({where: {id: jwt.payload.app as number}})
        if (!app || app.approved !== ApprovalStatus.approved || (app.accessGated && app.ownerId !== jwt.payload.user && !app.allowedUsers.includes(jwt.payload.user as number)) || !(jwt.payload.scopes as string[]).every(s => app.scopes.includes(s as Scope))) return false
        if (!(jwt.payload.scopes as string[]).every(s => authorization.scopes.includes(s))) {
            return false
        }

        return scope.every(s => (jwt.payload.scopes as string[]).includes(s))
    } catch {
        return false
    }
}

export async function authorizationFromHeader(request: NextRequest): Promise<Authorization | null> {
    const auth = request.headers.get('Authorization')
    if (auth == null || !auth.startsWith('Bearer ')) {
        return null
    }

    try {
        const jwt = await jwtVerify(auth.slice(7), secret, {
            algorithms: ['HS256'],
            issuer: 'https://access.beijing.academy'
        })

        if (!validPayload(jwt.payload) || jwt.payload.type !== 'access_token') {
            return null
        }

        if (!await validateAccessToken(auth.slice(7), [])) return null
        return await findTokenAuthorization(jwt.payload)
    } catch {
        return null
    }
}

function validPayload(payload: import('jose').JWTPayload): boolean {
    return Number.isSafeInteger(payload.user) && Number.isSafeInteger(payload.app) && Array.isArray(payload.scopes) && payload.scopes.every(s => typeof s === 'string') && typeof payload.exp === 'number'
}

async function findTokenAuthorization(payload: import('jose').JWTPayload, db: Pick<typeof prisma, 'authorization'> = prisma): Promise<Authorization | null> {
    const id = payload.authorizationId
    if (id !== undefined && !Number.isSafeInteger(id)) return null
    return db.authorization.findFirst({
        where: {
            userId: payload.user as number,
            applicationId: payload.app as number,
            ...(id === undefined ? {legacyTokens: true} : {id: id as number})
        }
    })
}
