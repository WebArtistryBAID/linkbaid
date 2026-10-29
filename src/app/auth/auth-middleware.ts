import {NextRequest, NextResponse} from 'next/server'
import {cookies} from 'next/headers'
import {findUserInternal} from '@/app/lib/utils'
import {hostedURL} from '@/app/lib/hosted-url'

const protectedRoutes = [
    '/',
    '/user',
    '/user/applications',
    '/user/applications/create',
    '/user/applications/view',
    '/approvals',
    '/authorizations',
    '/oauth2/authorize'
]

export default async function authMiddleware(req: NextRequest): Promise<NextResponse | null> {
    const path = req.nextUrl.pathname
    if (!(protectedRoutes.includes(path) || path.startsWith('/user/'))) {
        return null
    }
    const cookie = (await cookies()).get('access_token')?.value
    if (cookie == null) {
        return NextResponse.redirect(hostedURL(`/auth?redirect=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`))
    }
    try {
        if (await findUserInternal(cookie) == null) throw new Error('Unauthorized')
    } catch {
        return NextResponse.redirect(hostedURL(`/auth?redirect=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`))
    }

    return null
}
