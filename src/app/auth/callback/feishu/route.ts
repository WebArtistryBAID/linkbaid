import {NextRequest, NextResponse} from 'next/server'
import {loginWithFeishu} from '@/app/auth/callback/login'
import {hostedURL} from '@/app/lib/hosted-url'

export async function GET(request: NextRequest): Promise<NextResponse> {
    const target = await loginWithFeishu(
        request.nextUrl.searchParams.get('code'),
        request.nextUrl.searchParams.get('state')
    )
    return NextResponse.redirect(hostedURL(target))
}
