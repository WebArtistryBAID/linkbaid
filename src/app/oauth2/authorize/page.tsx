import Authorize from '@/app/oauth2/authorize/Authorize'
import Error from '@/app/oauth2/authorize/Error'
import {getMyAuthByApp} from '@/app/lib/user-actions'
import {getAppByClientID} from '@/app/lib/app-actions'
import {redirect} from 'next/navigation'
import {authorizeForCode} from '@/app/lib/authorize-actions'
import {Scope} from '@/generated/prisma/client'

export default async function AuthorizePage({searchParams}: { searchParams: never }) {
    if (!('client_id' in (await searchParams)) || !('response_type' in (await searchParams)) || !('redirect_uri' in (await searchParams)) || !('scope' in (await searchParams))) {
        return <Error message="errorParameters"/>
    }
    if ((await searchParams)['response_type'] !== 'code') return <Error message="errorResponseType"/>
    if (Object.values(await searchParams).some(value => typeof value !== 'string')) return <Error
        message="errorParameters"/>
    const app = await getAppByClientID((await searchParams)['client_id'])
    if (app == null) {
        return <Authorize/>
    }
    const auth = await getMyAuthByApp(app.id)
    const scopes = ((await searchParams)['scope'] as string).split(' ')
    if (auth == null) {
        return <Authorize/>
    }
    if (!(scopes.every(s => auth.scopes.includes(s)))) {
        return <Authorize/>
    }
    const code = await authorizeForCode(app.id, scopes.map(s => s as keyof typeof Scope), 'state' in (await searchParams) ? (await searchParams)['state'] as string : null, (await searchParams)['redirect_uri']!)
    if (code == null) return <Error message="errorRedirectURI"/>
    const destination = new URL((await searchParams)['redirect_uri'])
    destination.searchParams.set('code', code)
    if ('state' in (await searchParams)) destination.searchParams.set('state', (await searchParams)['state'])
    redirect(destination.toString())
}
