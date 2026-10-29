import {NextRequest, NextResponse} from 'next/server'
import {getUserIDFromHeader, validateFromHeader} from '@/app/lib/authorize-actions'
import {unauthorized} from '@/app/api/base'
import {prisma} from '@/app/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
    if (!await validateFromHeader(request, ['basic'])) {
        return unauthorized()
    }

    const id = await getUserIDFromHeader(request)
    if (id == null) return unauthorized()
    const user = await prisma.user.findUnique({
        where: {seiueId: id}, select: {
            seiueId: true, schoolId: true, createdAt: true, updatedAt: true,
            name: true, pinyin: true, adminClass0: true, classTeacher0: true,
            gender: true, lastUserAgent: true, admin: true, type: true,
            phone: await validateFromHeader(request, ['phone'])
        }
    })
    return user ? NextResponse.json(user) : unauthorized()
}
