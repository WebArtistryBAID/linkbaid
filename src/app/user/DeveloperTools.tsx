'use client'

import {useTranslationClient} from '@/app/i18n/client'
import Link from 'next/link'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faCode, faStamp} from '@fortawesome/free-solid-svg-icons'
import If from '@/app/lib/If'
import {useEffect, useState} from 'react'
import {User} from '@/generated/prisma/browser'
import {getMe} from '@/app/lib/user-actions'
import CookiesBoundary from '@/app/lib/CookiesBoundary'

export default function WrappedDeveloperTools() {
    return <CookiesBoundary><DeveloperTools/></CookiesBoundary>
}

function DeveloperTools() {
    const {t} = useTranslationClient('home')
    const [me, setMe] = useState<User | null | undefined>(undefined)
    const [showDev, setShowDev] = useState(false)

    useEffect(() => {
        (async () => {
            setMe(await getMe())
        })()

        document.addEventListener('keyup', e => {
            if (e.key === 'd' && e.ctrlKey) {
                setShowDev(prev => !prev)
            }
        })
    }, [])

    return <If condition={showDev}>
        <p className="text-xs text-center mt-5 mb-2 secondary lg:block hidden">{t('nav.developers')}</p>
        <Link href="/user/applications" className="nav-item">
            <div className="nav-image">
                <FontAwesomeIcon icon={faCode} aria-label={t('nav.applications')}/>
            </div>
            <p className="nav-content">{t('nav.applications')}</p>
        </Link>
        <If condition={me?.admin ?? false}>
            <Link href="/user/approvals" className="nav-item">
                <div className="nav-image">
                    <FontAwesomeIcon icon={faStamp} aria-label={t('nav.approval')}/>
                </div>
                <p className="nav-content">{t('nav.approval')}</p>
            </Link>
        </If>
    </If>
}
