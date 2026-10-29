import {NextRequest, NextResponse} from 'next/server'
import {createHash} from 'node:crypto'
import {createFeishuState} from '@/app/auth/callback/login'
import {localRedirect} from '@/app/lib/redirect-target'

export async function GET(request: NextRequest) {
    const target = localRedirect(request.nextUrl.searchParams.get('redirect'))
    const state = await createFeishuState(target)
    const feishu = request.nextUrl.searchParams.get('provider') === 'feishu'
    const url = new URL(feishu ? 'https://accounts.feishu.cn/open-apis/authen/v1/authorize' : 'https://passport.seiue.com/authorize')
    url.searchParams.set('client_id', (feishu ? process.env.FEISHU_APP_ID : process.env.SEIUE_CLIENT_ID)!)
    url.searchParams.set('response_type', feishu ? 'code' : 'token')
    url.searchParams.set('scope', feishu ? 'contact:user.phone:readonly contact:user.employee_id:readonly' : 'reflection.read_basic')
    url.searchParams.set('state', state)
    const callback = new URL(feishu ? '/auth/callback/feishu' : '/auth/callback', process.env.HOSTED!)
    if (!feishu) {
        url.searchParams.set('school_id', '452')
        callback.searchParams.set('redirect', target)
        callback.searchParams.set('state', state)
    }
    url.searchParams.set('redirect_uri', callback.toString())
    const response = NextResponse.redirect(url)
    response.cookies.set('oauth_state', createHash('sha256').update(state).digest('hex'), {
        httpOnly: true, secure: process.env.HOSTED?.startsWith('https:') === true,
        sameSite: 'lax', path: '/', maxAge: 600
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
}
