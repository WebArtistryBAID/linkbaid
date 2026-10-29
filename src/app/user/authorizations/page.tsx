import {useTranslation} from '@/app/i18n'
import {getMyAuths} from '@/app/lib/user-actions'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faHourglassEmpty} from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import {AppIcon} from '@/app/user/applications/AppIcon'
import {getAppByID} from '@/app/lib/app-actions'

export default async function Authorizations() {
    const {t} = await useTranslation('authorizations')
    const auths = await getMyAuths()

    if (auths.length < 1) {
        return <div className="w-full h-full flex-col flex">
            <h1 className="flex-shrink">{t('title')}</h1>
            <div className="flex-grow flex flex-col justify-center items-center">
                <FontAwesomeIcon icon={faHourglassEmpty} className="!h-16 text-gray-400 dark:text-gray-600 mb-3"/>
                <p className="text-sm">{t('noApps')}</p>
            </div>
        </div>
    }

    return <div>
        <h1 className="mb-5">{t('title')}</h1>
        {auths.map(async auth => {
            const app = (await getAppByID(auth.applicationId))!
            return <Link href={`/user/authorizations/view?auth=${auth.id}`} key={auth.id}
                         className="flex items-center h-16 p-3 w-full rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-100">
                <div className="h-8 w-8 mr-3">
                    <AppIcon uploadable={false} size="small" app={app}/>
                </div>
                <p>{app.name}</p>
            </Link>
        })}
    </div>
}
