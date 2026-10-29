'use client'

import Error from './Error'
import {ApplicationSimple, getAppByClientID} from '@/app/lib/app-actions'
import {ApprovalStatus, Scope, User} from '@/generated/prisma/browser'
import {AppIcon} from '@/app/user/applications/AppIcon'
import {getMe, getUserNameByID} from '@/app/lib/user-actions'
import {Trans} from 'react-i18next/TransWithoutContext'
import {authorizeForCode} from '@/app/lib/authorize-actions'
import {useTranslationClient} from '@/app/i18n/client'
import {Suspense, useEffect, useState} from 'react'
import {useSearchParams} from 'next/navigation'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faSpinner} from '@fortawesome/free-solid-svg-icons'
import CookiesBoundary from '@/app/lib/CookiesBoundary'

function Sub() {
    const {t} = useTranslationClient('authorize')

    const searchParams = useSearchParams()

    if (searchParams.get('response_type') !== 'code') {
        return <Error message="errorResponseType"/>
    }

    const [app, setApp] = useState<ApplicationSimple | null | undefined>(undefined)
    const [appOwner, setAppOwner] = useState<string | null>(null)
    const [me, setMe] = useState<User | null | undefined>(undefined)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        (async () => {
            const a = await getAppByClientID(searchParams.get('client_id')!)
            setApp(a)
            if (a != null) {
                setAppOwner(await getUserNameByID(a.ownerId))
            }
            setMe(await getMe())
        })()
    }, [searchParams])

    if (app === undefined || me === undefined) {
        return <div className="flex justify-center items-center h-full">
            <FontAwesomeIcon icon={faSpinner} spin={true} className="secondary h-8"/>
        </div>
    }

    if (app == null || me == null) {
        return <Error message="errorApp"/>
    }

    if (app.approved !== ApprovalStatus.approved && app.ownerId !== me.seiueId) {
        return <Error message="errorApproval"/>
    }

    let destination: URL
    try {
        destination = new URL(searchParams.get('redirect_uri')!)
    } catch {
        return <Error message="errorRedirectURI"/>
    }
    if (!['http:', 'https:'].includes(destination.protocol) || destination.username || destination.password || destination.hash || !app.redirectUrls.includes(searchParams.get('redirect_uri')!)) {
        return <Error message="errorRedirectURI"/>
    }

    const scopes = searchParams.get('scope')!.split(' ')
    for (const scope of scopes) {
        if (!app.scopes.includes(scope as keyof typeof Scope)) {
            return <Error message="errorScope"/>
        }
    }

    function callback(values: Record<string, string>): string {
        const destination = new URL(searchParams.get('redirect_uri')!)
        for (const [key, value] of Object.entries(values)) destination.searchParams.set(key, value)
        const state = searchParams.get('state')
        if (state != null) destination.searchParams.set('state', state)
        return destination.toString()
    }

    return <div className="flex justify-center items-center flex-col p-8 h-full">
        <AppIcon uploadable={false} size="big" app={app}/>
        <h1 className="m-5 text-center">{t('title')}</h1>
        <p className="mb-1 text-center"><Trans t={t} i18nKey="message" values={{name: app.name}}
                                               components={{1: <b/>}}/></p>
        <p className="mb-3 text-center italic">{app.message}</p>
        <ul className="list-disc list-inside mb-3">
            {scopes.map(scope => <li key={scope}>{t(`scopeMessages.${scope}`)}</li>)}
            <li><Trans t={t} i18nKey="scopeMessages.noPassword" components={{1: <b/>}}/></li>
        </ul>
        <p className="text-xs secondary mb-5">
            <Trans t={t} i18nKey="appInfo" values={{name: app.name, owner: appOwner}}
                   components={{
                       1: <a className="inline" href={app.terms!}/>,
                       2: <a className="inline" href={app.privacy!}/>
                   }}/>
        </p>

        <button onClick={async () => {
            setLoading(true)
            const code = await authorizeForCode(app.id, scopes.map(s => s as keyof typeof Scope), searchParams.has('state') ? searchParams.get('state') : null, searchParams.get('redirect_uri')!)
            if (code == null) {
                location.href = callback({
                    error: 'access_denied',
                    error_description: 'The authorization request failed'
                })
                return
            }
            location.href = callback({code})
        }} disabled={loading} className="btn w-full mb-3">{t(loading ? 'authorizing' : 'approve')}</button>
        <a href={callback({error: 'access_denied', error_description: 'The user denied the authorization request'})}
           className="btn-secondary w-full text-center">{t('cancel')}</a>
    </div>
}

export default function Authorize() {
    return <Suspense><CookiesBoundary><Sub/></CookiesBoundary></Suspense>
}
