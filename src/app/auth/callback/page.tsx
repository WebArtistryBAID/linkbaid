'use client'

import {useTranslationClient} from '@/app/i18n/client'
import {Suspense, useEffect, useRef} from 'react'
import {useSearchParams} from 'next/navigation'
import login from '@/app/auth/callback/login'
import CookiesBoundary from '@/app/lib/CookiesBoundary'

function Sub() {
    const search = useSearchParams()
    const started = useRef(false)
    const {t} = useTranslationClient('auth')

    useEffect(() => {
        if (started.current) return
        started.current = true
        const redir = search.get('redirect')
        if (!location.hash) {
            location.replace('/auth?error=seiue')
            return
        }
        const match = location.hash.replace('#', '').match(/access_token=([^&]*)/)

        if (match && match[1]) {
            const token = decodeURIComponent(match[1])
            history.replaceState(null, '', location.pathname + location.search)
            login(false, token, redir!, search.get('state')).then(url => {
                location.replace(url)
            })
        }
    }, [search])

    return <div className="flex justify-center items-center h-screen">
        <p>{t('callback')}</p>
    </div>
}

export default function AuthCallback() {
    return <Suspense><CookiesBoundary><Sub/></CookiesBoundary></Suspense>
}
