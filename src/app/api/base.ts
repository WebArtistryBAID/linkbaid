import {NextResponse} from 'next/server'

export function unauthorized(): NextResponse {
    return NextResponse.json(
        {
            error: 'unauthorized',
            error_description: 'Invalid access token or incorrect scope'
        }, {
            status: 401
        })
}

export function tooManyRequests(): NextResponse {
    return NextResponse.json(
        {
            error: 'too_many_requests',
            error_description: 'You have sent too many requests in a short period of time'
        }, {
            status: 429
        })
}

export function badRequest(): NextResponse {
    return NextResponse.json(
        {
            error: 'bad_request',
            error_description: 'The request is invalid'
        }, {
            status: 400
        })
}

export function internalError(message: string): NextResponse {
    return NextResponse.json(
        {
            error: 'internal_error',
            error_description: message
        }, {
            status: 500
        })
}

export function success(): NextResponse {
    return NextResponse.json(
        {
            success: true
        })
}
