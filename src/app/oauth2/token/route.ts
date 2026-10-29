import {readOAuthForm} from '@/app/lib/oauth-form'
import {NextRequest, NextResponse} from 'next/server'
import {authorizeForTokens, refreshToken} from '@/app/lib/authorize-actions'

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!request.headers.has('Authorization')) {
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
    if (!request.headers.get('Authorization')!.startsWith('Basic ')) {
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
    let data: FormData
    try {
        data = await readOAuthForm(request)
    } catch {
        return NextResponse.json({
            error: 'invalid_request',
            error_description: 'The request is invalid.'
        }, {status: 400})
    }
    if (!data.has('grant_type')) {
        return NextResponse.json(
            {
                error: 'unsupported_grant_type',
                error_description: 'The provided grant type is not supported.'
            },
            {
                status: 400
            }
        )
    }
    const grantType = data.get('grant_type') as string
    if (grantType === 'authorization_code') {
        const result = await authorizeForTokens(
            data.get('code') as string,
            auth,
            grantType,
            data.get('redirect_uri') as string
        )
        if ('error' in result) {
            return NextResponse.json(
                result,
                {
                    status: 400
                }
            )
        }
        return NextResponse.json(result)
    } else if (grantType === 'refresh_token') {
        const result = await refreshToken(
            data.get('refresh_token') as string,
            auth,
            grantType,
            data.has('scope') ? (data.get('scope') as string).split(' ') : null
        )
        if ('error' in result) {
            return NextResponse.json(
                result,
                {
                    status: 400
                }
            )
        }
        return NextResponse.json(result)
    }
    return NextResponse.json(
        {
            error: 'unsupported_grant_type',
            error_description: 'The provided grant type is not supported.'
        },
        {
            status: 400
        }
    )
}
