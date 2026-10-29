import {NextRequest, NextResponse} from 'next/server'
import authMiddleware from '@/app/auth/auth-middleware'

export default async function proxy(req: NextRequest) {
    const middlewares = [
        await authMiddleware(req)
    ]
    const response = middlewares.find(Boolean) ?? NextResponse.next()
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'no-referrer')
    if (req.nextUrl.pathname.startsWith('/oauth2/') || req.nextUrl.pathname.startsWith('/api/') || req.nextUrl.pathname.startsWith('/auth/') || req.nextUrl.pathname.startsWith('/user')) {
        response.headers.set('Cache-Control', 'no-store')
    }
    return response
}

