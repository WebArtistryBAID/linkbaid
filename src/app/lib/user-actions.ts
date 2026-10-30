'use server'

import {Application, Authorization, Gender, User, UserType} from '@/generated/prisma/client'
import {findUserOrThrow} from '@/app/lib/utils'
import {cookies} from 'next/headers'
import {revokeSession} from '@/app/lib/session-revocation'
import {prisma} from '@/app/lib/prisma'

export async function getMe(): Promise<User> {
    return sanitizeUser((await prisma.user.findUnique({
        where: {
            seiueId: await findUserOrThrow()
        }
    }))!)
}

export interface UserSimple {
    seiueId: number
    schoolId: string
    createdAt: Date
    updatedAt: Date
    name: string
    pinyin: string
    adminClass0: string | null
    classTeacher0: string | null
    gender: Gender
    lastUserAgent: string
    admin: boolean
    type: UserType
}

export async function getUserByID(id: number): Promise<User> {
    const me = await getMe()
    if (me.seiueId !== id && !me.admin) throw new Error('Unauthorized')
    return sanitizeUser((await prisma.user.findUnique({
        where: {
            seiueId: id
        }
    }))!)
}

export async function getUserSimpleByID(id: number): Promise<UserSimple> {
    const me = await getMe()
    if (me.seiueId !== id && !me.admin) throw new Error('Unauthorized')
    const user = await prisma.user.findUniqueOrThrow({
        where: {seiueId: id},
        select: {
            seiueId: true,
            schoolId: true,
            createdAt: true,
            updatedAt: true,
            name: true,
            pinyin: true,
            adminClass0: true,
            classTeacher0: true,
            gender: true,
            lastUserAgent: true,
            admin: true,
            type: true
        }
    })
    return user
}

export async function getUserNameByID(id: number): Promise<string> {
    await findUserOrThrow()
    return (await prisma.user.findUnique({
        where: {
            seiueId: id
        }
    }))!.name
}

export async function getMyAuths(): Promise<Authorization[]> {
    return (await prisma.authorization.findMany({
        where: {
            userId: await findUserOrThrow()
        }
    }))
}

export async function getMyAuthByID(id: number): Promise<Authorization> {
    return (await prisma.authorization.findUnique({
        where: {
            id,
            userId: await findUserOrThrow()
        }
    }))!
}

export async function getMyAuthByApp(appId: number): Promise<Authorization | null> {
    return (await prisma.authorization.findFirst({
        where: {
            userId: await findUserOrThrow(),
            applicationId: appId
        }
    }))!
}

export async function getMyApps(): Promise<Application[]> {
    return (await prisma.application.findMany({
        where: {
            ownerId: await findUserOrThrow()
        }
    }))
}

export async function getMyAppsSecure(): Promise<Application[]> {
    return (await prisma.application.findMany({
        where: {
            ownerId: await findUserOrThrow()
        }
    })).map(app => {
        app.clientSecret = ''
        return app
    })
}

export async function logOut(): Promise<void> {
    const c = await cookies()
    const token = c.get('access_token')?.value
    if (token) await revokeSession(token)
    c.delete('access_token')
}

function sanitizeUser(user: User): User {
    if (!user) throw new Error('Unauthorized')
    return {...user, accessToken: null, lastSMSCode: null, lastSMSPhone: null}
}
