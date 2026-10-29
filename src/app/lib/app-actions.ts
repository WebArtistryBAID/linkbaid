'use server'

import {Application, ApprovalRequest, ApprovalStatus} from '@/generated/prisma/client'
import {randomBytes, randomUUID, timingSafeEqual} from 'node:crypto'
import {findUserOrThrow} from '@/app/lib/utils'
import path from 'node:path'
import sharp from 'sharp'
import fsPromise from 'node:fs/promises'
import {getMe} from '@/app/lib/user-actions'
import {prisma} from '@/app/lib/prisma'

export interface ApplicationSimple {
    id: number
    name: string
    icon: string | null
    redirectUrls: string[]
    scopes: string[]
    clientId: string
    ownerId: number
    message: string
    approved: ApprovalStatus
    homepage: string
    terms: string | null
    privacy: string | null
    accessGated: boolean
}

export async function getApps(): Promise<ApplicationSimple[]> {
    const user = await getMe()
    return prisma.application.findMany({
        where: {
            approved: ApprovalStatus.approved,
            OR: [
                {
                    allowedUsers: {
                        hasSome: [user.seiueId]
                    }
                },
                {
                    accessGated: false
                },
                {
                    ownerId: user.seiueId
                }
            ]
        },
        select: {
            id: true,
            name: true,
            icon: true,
            redirectUrls: true,
            scopes: true,
            clientId: true,
            ownerId: true,
            message: true,
            approved: true,
            homepage: true,
            terms: true,
            privacy: true,
            accessGated: true
        }
    })
}

export async function getAppByClientID(clientID: string): Promise<ApplicationSimple | null> {
    const user = await getMe()
    return prisma.application.findFirst({
        where: {
            clientId: clientID,
            approved: ApprovalStatus.approved,
            OR: [
                {
                    allowedUsers: {
                        hasSome: [user.seiueId]
                    }
                },
                {
                    accessGated: false
                },
                {
                    ownerId: user.seiueId
                }
            ]
        },
        select: {
            id: true,
            name: true,
            icon: true,
            redirectUrls: true,
            scopes: true,
            clientId: true,
            ownerId: true,
            message: true,
            approved: true,
            homepage: true,
            terms: true,
            privacy: true,
            accessGated: true
        }
    })
}

export async function getAppByID(id: number): Promise<ApplicationSimple | null> {
    return prisma.application.findFirst({
        where: {
            id,
            approved: ApprovalStatus.approved
        },
        select: {
            id: true,
            name: true,
            icon: true,
            redirectUrls: true,
            scopes: true,
            clientId: true,
            ownerId: true,
            message: true,
            approved: true,
            homepage: true,
            terms: true,
            privacy: true,
            accessGated: true
        }
    })
}

export async function verifyAppSecretByID(id: number, secret: string): Promise<boolean> {
    const app = await prisma.application.findFirst({
        where: {
            id
        }
    })
    if (!app || typeof secret !== 'string') return false
    const supplied = Buffer.from(secret)
    const expected = Buffer.from(app.clientSecret)
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export async function createApp(formData: FormData): Promise<Application> {
    const user = await findUserOrThrow()
    if (typeof formData.get('name') !== 'string' || !(formData.get('name') as string).trim() || (formData.get('name') as string).length > 200) throw new Error('Invalid name')
    validateURL(formData.get('homepage') as string)
    const app = await prisma.application.create({
        data: {
            name: formData.get('name') as string,
            homepage: formData.get('homepage') as string,
            icon: null,
            redirectUrls: [],
            scopes: [],
            clientId: randomUUID(),
            clientSecret: randomBytes(32).toString('hex'),
            owner: {
                connect: {
                    seiueId: user
                }
            },
            message: '',
            approved: ApprovalStatus.pending,
            terms: null,
            privacy: null
        }
    })
    await prisma.appAuditLog.create({
        data: {
            type: 'created',
            application: {
                connect: {
                    id: app.id
                }
            },
            operationUser: {
                connect: {
                    seiueId: user
                }
            }
        }
    })
    return app
}

export async function getMyAppByIDSecure(id: number): Promise<Application | null> {
    const user = await getMe()
    const app = await prisma.application.findFirst({
        where: {
            id,
            ownerId: user.admin ? undefined : user.seiueId
        }
    })
    if (app) app.clientSecret = ''
    return app
}

export async function refreshAppSecret(id: number): Promise<string> {
    const user = await getMe()
    const app = await prisma.application.findFirst({
        where: {
            id,
            ownerId: user.admin ? undefined : user.seiueId
        }
    })
    if (app == null) {
        throw new Error('Application not found')
    }
    await prisma.appAuditLog.create({
        data: {
            type: 'updated',
            application: {
                connect: {
                    id: app.id
                }
            },
            operationUser: {
                connect: {
                    seiueId: user.seiueId
                }
            }
        }
    })
    const secret = randomBytes(32).toString('hex')
    await prisma.application.update({
        where: {
            id: app.id
        },
        data: {
            clientSecret: secret
        }
    })
    return secret
}

export async function getMyAppByID(id: number): Promise<Application | null> {
    const user = await getMe()
    return prisma.application.findFirst({
        where: {
            id,
            ownerId: user.admin ? undefined : user.seiueId
        }
    })
}

export async function getApprovalRequests(): Promise<ApprovalRequest[]> {
    const user = await getMe()
    if (!user.admin) {
        throw new Error('You do not have permission to view approval requests')
    }
    return prisma.approvalRequest.findMany()
}

export async function getApprovalRequestForApp(id: number): Promise<ApprovalRequest | null> {
    const app = await getMyAppByID(id)
    if (app == null) {
        throw new Error('Application not found')
    }
    return prisma.approvalRequest.findFirst({
        where: {
            applicationId: id
        }
    })
}

export async function createApprovalRequest(id: number): Promise<ApprovalRequest> {
    const app = await getMyAppByID(id)
    if (app == null || app.ownerId !== (await getMe()).seiueId) {
        throw new Error('Application not found')
    }
    if (app.approved !== ApprovalStatus.pending || app.terms == null || app.privacy == null || app.terms.length < 1 || app.privacy.length < 1 || app.message.length < 1) {
        throw new Error('Incorrect application status')
    }
    if ((await getApprovalRequestForApp(id)) != null) {
        throw new Error('Approval request already exists')
    }
    return prisma.approvalRequest.create({
        data: {
            application: {
                connect: {
                    id
                }
            }
        }
    })
}

export async function updateApp(data: Partial<Application>): Promise<Application> {
    const user = await getMe()
    if (!Number.isSafeInteger(data.id)) throw new Error('Invalid application ID')
    const allowed = ['id', 'homepage', 'terms', 'privacy', 'message', 'redirectUrls', 'scopes', 'accessGated', 'allowedUsers']
    if (Object.keys(data).some(key => !allowed.includes(key))) throw new Error('Invalid update fields')
    for (const key of ['homepage', 'terms', 'privacy'] as const) {
        if (data[key] != null && data[key] !== '') validateURL(data[key]!)
    }
    if (data.redirectUrls !== undefined) {
        if (!Array.isArray(data.redirectUrls) || data.redirectUrls.length > 100) throw new Error('Invalid redirect URLs')
        data.redirectUrls.forEach(validateURL)
    }
    if (data.scopes !== undefined && (!Array.isArray(data.scopes) || data.scopes.some(s => !['basic', 'phone', 'calendar', 'sms'].includes(s)))) throw new Error('Invalid scopes')
    if (data.accessGated !== undefined && typeof data.accessGated !== 'boolean') throw new Error('Invalid access gate')
    if (data.allowedUsers !== undefined && (!Array.isArray(data.allowedUsers) || data.allowedUsers.some(id => !Number.isSafeInteger(id)))) throw new Error('Invalid users')
    if (data.message !== undefined && (typeof data.message !== 'string' || data.message.length > 10000)) throw new Error('Invalid message')
    const app = await prisma.application.findFirst({
        where: {
            id: data.id!,
            ownerId: user.admin ? undefined : user.seiueId
        }
    })
    if (app == null) {
        throw new Error('Application not found')
    }
    await prisma.appAuditLog.create({
        data: {
            type: 'updated',
            application: {
                connect: {
                    id: app.id
                }
            },
            operationUser: {
                connect: {
                    seiueId: user.seiueId
                }
            }
        }
    })
    if (data.clientSecret != null || data.icon != null || data.clientId != null || data.approved != null ||
        data.createdAt != null || data.updatedAt != null || data.ownerId != null || data.name != null) {
        throw new Error('Invalid update for certain fields')
    }
    data.approved = ApprovalStatus.pending // Require re-approval when updating app
    return prisma.application.update({
        where: {
            id: app.id
        },
        data
    })
}

export async function setAppApprovalStatus(id: number, approved: ApprovalStatus): Promise<Application> {
    const user = await getMe()
    if (!user.admin) {
        throw new Error('You do not have permission to approve applications')
    }
    const app = await prisma.application.findFirst({
        where: {
            id
        }
    })
    if (app == null) {
        throw new Error('Application not found')
    }
    await prisma.appAuditLog.create({
        data: {
            type: 'updated',
            application: {
                connect: {
                    id: app.id
                }
            },
            operationUser: {
                connect: {
                    seiueId: user.seiueId
                }
            }
        }
    })
    await prisma.approvalRequest.deleteMany({
        where: {
            applicationId: app.id
        }
    })
    return prisma.application.update({
        where: {
            id: app.id
        },
        data: {
            approved
        }
    })
}

export async function deleteApp(id: number): Promise<void> {
    const user = await getMe()
    const app = await prisma.application.findFirst({
        where: {
            id,
            ownerId: user.admin ? undefined : user.seiueId
        }
    })
    if (app == null) {
        throw new Error('Application not found')
    }
    await prisma.application.delete({
        where: {
            id
        }
    })
}

export async function uploadAppIcon(formData: FormData): Promise<Application> {
    const user = await getMe()
    const app = await prisma.application.findFirst({
        where: {
            id: parseInt(formData.get('id') as string),
            ownerId: user.admin ? undefined : user.seiueId
        }
    })
    if (app == null) {
        throw new Error('Application not found')
    }
    const file = formData.get('icon') as File
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024) throw new Error('Invalid icon')
    const root = process.env.UPLOAD_ROOT

    await fsPromise.mkdir(path.join(root!, 'app-icons'), {recursive: true})

    const fn = `${app.id}-${randomUUID().toString()}.webp`
    await sharp(Buffer.from(await file.arrayBuffer()), {limitInputPixels: 16000000})
        .resize({
            width: 512,
            height: 512
        })
        .webp({
            quality: 90
        })
        .toFile(path.join(root!, 'app-icons', fn))
    await prisma.appAuditLog.create({
        data: {
            type: 'updated',
            application: {
                connect: {
                    id: app.id
                }
            },
            operationUser: {
                connect: {
                    seiueId: user.seiueId
                }
            }
        }
    })
    const updated = await prisma.application.update({
        where: {
            id: app.id
        },
        data: {
            icon: `/app-icons/${fn}`
        }
    })
    if (app.icon != null && /^\/app-icons\/[a-zA-Z0-9-]+\.webp$/.test(app.icon)) {
        await fsPromise.rm(path.join(root!, 'app-icons', path.basename(app.icon)), {force: true}).catch(() => undefined)
    }
    return updated
}

function validateURL(value: string): void {
    if (typeof value !== 'string' || value.length > 4096) throw new Error('Invalid URL')
    const url = new URL(value)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Invalid URL')
}
