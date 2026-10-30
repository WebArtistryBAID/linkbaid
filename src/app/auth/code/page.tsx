'use client'

import {localRedirect} from '@/app/lib/redirect-target'

import Link from 'next/link'
import React, {Suspense, useState} from 'react'
import {useTranslationClient} from '@/app/i18n/client'
import {useSearchParams} from 'next/navigation'
import {loginWithAccessCode} from '@/app/auth/callback/login'
import If from '@/app/lib/If'
import Branding from '@/app/lib/Branding'
import CookiesBoundary from '@/app/lib/CookiesBoundary'

function Sub() {
    const {t} = useTranslationClient('auth')
    const search = useSearchParams()
    const [value, setValue] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)

    const redirect = localRedirect(search.get('redirect'))

    return <div className="simple-container">
        <Branding/>
        <div className="p-5 w-full h-full flex flex-col justify-center items-center">
            <h1 className="mb-1 text-center">{t('accessCode')}</h1>
            <p className="text-center text-sm mb-5">{t('accessCodeDescription')}</p>
            <input className="text w-full mb-3" type="text" autoFocus={true}
                   placeholder={t('accessCodePlaceholder')} value={value}
                   onChange={e => {
                       setValue(e.currentTarget.value)
                       setError(false)
                   }}/>
            <If condition={error}>
                <p className="text-red-500 mb-3">{t('accessCodeError')}</p>
            </If>

            <div className="flex gap-3 w-full">
                <button onClick={async () => {
                    if (value.length < 1) {
                        return
                    }
                    setLoading(true)
                    if (await loginWithAccessCode(value)) {
                        location.replace(redirect)
                        return
                    } else {
                        setError(true)
                    }
                    setLoading(false)
                }} disabled={loading} className="mb-3 btn flex-1 text-center">{t('title')}</button>
                <Link href="/auth" className="mb-3 btn-secondary flex-1 text-center">{t('back')}</Link>
            </div>
        </div>
    </div>
}

export default function AccessCodePage() {
    return <Suspense><CookiesBoundary><Sub/></CookiesBoundary></Suspense>
}
