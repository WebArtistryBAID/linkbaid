'use client'

import {useTranslationClient} from '@/app/i18n/client'
import CookiesBoundary from '@/app/lib/CookiesBoundary'

export default function WrappedParentError() {
    return <CookiesBoundary><ParentError/></CookiesBoundary>
}

function ParentError() {
    const {t} = useTranslationClient('auth')
    return <div className="flex justify-center items-center h-screen">
        <p>{t('parent')}</p>
    </div>
}
