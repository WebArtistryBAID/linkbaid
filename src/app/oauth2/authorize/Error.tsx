'use client'

import {useTranslationClient} from '@/app/i18n/client'
import {faExclamationTriangle} from '@fortawesome/free-solid-svg-icons'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import CookiesBoundary from '@/app/lib/CookiesBoundary'

export default function Error({message}: { message: string }) {
    return <CookiesBoundary><WrappedError message={message}/></CookiesBoundary>
}

function WrappedError({message}: { message: string }) {
    const {t} = useTranslationClient('authorize')
    return <div className="flex justify-center items-center flex-col p-8 h-full">
        <FontAwesomeIcon icon={faExclamationTriangle} className="!h-12 mb-3 text-red-500"/>
        <h1 className="mb-5">{t('error')}</h1>
        <p className="text-center mb-5">{t(message)}</p>
        <button className="btn w-full" onClick={() => history.back()}>{t('back')}</button>
    </div>
}
