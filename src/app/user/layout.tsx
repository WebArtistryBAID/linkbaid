import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faHome, faRightFromBracket, faTicket} from '@fortawesome/free-solid-svg-icons'
import {useTranslation} from '@/app/i18n'
import Link from 'next/link'
import Branding from '@/app/lib/Branding'
import DeveloperTools from '@/app/user/DeveloperTools'

export default async function UserLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    const {t} = await useTranslation('home')

    return <main>
        <div className="base-container relative">
            <Branding/>
            <div className="base-nav">
                <Link href="/user" className="nav-item">
                    <div className="nav-image">
                        <FontAwesomeIcon icon={faHome} aria-label={t('nav.home')}/>
                    </div>
                    <p className="nav-content">{t('nav.home')}</p>
                </Link>
                <Link href="/user/authorizations" className="nav-item">
                    <div className="nav-image">
                        <FontAwesomeIcon icon={faTicket} aria-label={t('nav.authorizations')}/>
                    </div>
                    <p className="nav-content">{t('nav.authorizations')}</p>
                </Link>
                <Link href="/user/logout" className="nav-item">
                    <div className="nav-image">
                        <FontAwesomeIcon icon={faRightFromBracket} aria-label={t('nav.logout')}/>
                    </div>
                    <p className="nav-content">{t('nav.logout')}</p>
                </Link>
                <DeveloperTools/>
            </div>
            <div className="base-content">
                {children}
            </div>
        </div>
    </main>
}
