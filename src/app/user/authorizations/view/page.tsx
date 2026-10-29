'use client'

import {useTranslationClient} from '@/app/i18n/client'
import {Suspense, useEffect, useState} from 'react'
import {ApplicationSimple, getAppByID} from '@/app/lib/app-actions'
import {Authorization} from '@/generated/prisma/browser'
import {useRouter, useSearchParams} from 'next/navigation'
import {getMyAuthByID, getUserNameByID} from '@/app/lib/user-actions'
import {AppIcon} from '@/app/user/applications/AppIcon'
import {Trans} from 'react-i18next/TransWithoutContext'
import {revokeMyAuthorization} from '@/app/lib/authorize-actions'
import CookiesBoundary from '@/app/lib/CookiesBoundary'

function Sub() {
    const {t} = useTranslationClient('authorizations')
    const searchParams = useSearchParams()
    const router = useRouter()

    const [app, setApp] = useState<ApplicationSimple | null>(null)
    const [auth, setAuth] = useState<Authorization | null>(null)
    const [ownerName, setOwnerName] = useState<string | null>(null)

    useEffect(() => {
        (async () => {
            const a = await getMyAuthByID(parseInt(searchParams.get('auth')!))
            setAuth(a)
            const ap = await getAppByID(a.applicationId)
            setApp(ap)
            setOwnerName(await getUserNameByID(ap!.ownerId))
        })()
    }, [searchParams])

    if (!auth || !app || !ownerName) {
        return <div className="w-full h-full">
            <div className="rounded bg-secondary w-1/2 h-8 mb-2"></div>
            <div className="rounded bg-secondary w-full h-8 mb-2"></div>
            <div className="rounded bg-secondary w-full h-8 mb-5"></div>
            <div className="rounded bg-secondary w-2/3 h-8 mb-2"></div>
            <div className="rounded bg-secondary w-full h-8 mb-2"></div>
            <div className="rounded bg-secondary w-full h-8 mb-2"></div>
        </div>
    }

    return <div className="h-full overflow-y-auto flex flex-col justify-center">
        <div className="flex flex-col justify-center items-center">
            <AppIcon app={app} size="big" uploadable={false}/>
            <h1 className="mt-3 mb-1">{app.name}</h1>
            <p className="mb-1">
                <Trans t={t} i18nKey="operatedBy" values={{owner: ownerName}} components={{1: <b></b>}}/>
            </p>
            <p className="italic mb-5">
                {app.message}
            </p>
            <p className="text-xs secondary mb-3"
               dangerouslySetInnerHTML={{__html: t('info', {createTime: auth.createdAt.toLocaleDateString()})}}/>
            <ul className="list-inside list-disc mb-3">
                {auth.scopes.map(scope => <li key={scope}>{t(`scopeMessages.${scope}`)}</li>)}
            </ul>
            <p className="text-xs secondary mb-5">
                <Trans t={t} i18nKey="terms" components={{
                    1: <a href={app.terms!} className="inline"/>,
                    2: <a href={app.privacy!} className="inline"/>
                }}/>
            </p>
            <button className="btn-danger" onClick={async () => {
                await revokeMyAuthorization(auth)
                router.push('/user/authorizations')
            }}>{t('deauthorize')}</button>
        </div>
    </div>
}

export default function ViewAuthorization() {
    return <Suspense><CookiesBoundary><Sub/></CookiesBoundary></Suspense>
}
