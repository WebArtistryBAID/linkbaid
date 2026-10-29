'use client'

import {useTranslationClient} from '@/app/i18n/client'
import {Suspense, useEffect} from 'react'
import {useRouter, useSearchParams} from 'next/navigation'
import login from '@/app/auth/callback/login'
import CookiesBoundary from '@/app/lib/CookiesBoundary'

function Sub() {
    const search = useSearchParams()
    const router = useRouter()
    const {t} = useTranslationClient('auth')

    useEffect(() => {
        const redir = search.get('redirect')
        if (!location.hash) {
            router.replace('/auth?error=seiue')
            return
        }
        const match = location.hash.replace('#', '').match(/access_token=([^&]*)/)

        if (match && match[1]) {
            const token = decodeURIComponent(match[1])
            history.replaceState(null, '', location.pathname + location.search)
            login(false, token, redir!, search.get('state')).then(url => {
                router.push(url)
            })
        }
    }, [router, search])

    return <div className="flex justify-center items-center h-screen">
        <p>{t('callback')}</p>
    </div>
}

export default function AuthCallback() {
    return <Suspense><CookiesBoundary><Sub/></CookiesBoundary></Suspense>
}
