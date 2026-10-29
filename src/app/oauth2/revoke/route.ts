import {readOAuthForm} from '@/app/lib/oauth-form'
import {NextRequest, NextResponse} from 'next/server'
import {revokeToken} from '@/app/lib/authorize-actions'

export async function POST(request: NextRequest) {
    if (!request.headers.get('Authorization')?.startsWith('Basic ')) {
        return NextResponse.json(
            {
                error: 'invalid_client',
                error_description: 'The client credentials are invalid.'
            },
            {
                status: 400
            }
        )
    }
    const auth = request.headers.get('Authorization')!.replace('Basic ', '')
    let data: FormData
    try {
        data = await readOAuthForm(request)
    } catch {
        return NextResponse.json({
            error: 'invalid_request',
            error_description: 'The request is invalid.'
        }, {status: 400})
    }
    if (await revokeToken(data.get('token') as string, auth)) {
        return NextResponse.json({})
    }
    return NextResponse.json(
        {
            error: 'invalid_revoke',
            error_description: 'Failed to revoke the token.'
        },
        {
            status: 400
        }
    )
}
