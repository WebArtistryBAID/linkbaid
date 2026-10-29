import {useTranslation} from '@/app/i18n'
import {getMyAppsSecure} from '@/app/lib/user-actions'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faHourglassEmpty} from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import {AppIcon} from '@/app/user/applications/AppIcon'

export default async function Applications() {
    const {t} = await useTranslation('applications')
    const apps = await getMyAppsSecure()

    if (apps.length < 1) {
        return <div className="w-full h-full flex-col flex">
            <h1 className="flex-shrink">{t('title')}</h1>
            <div className="flex-grow flex flex-col justify-center items-center">
                <FontAwesomeIcon icon={faHourglassEmpty} className="!h-16 text-gray-400 dark:text-gray-600 mb-3"/>
                <p className="text-sm mb-3">{t('noApps')}</p>
                <Link href="/user/applications/create" className="btn">{t('create.text')}</Link>
            </div>
        </div>
    }

    return <div className="relative h-full overflow-y-auto">
        <h1 className="mb-5">{t('title')}</h1>
        {apps.map(app => <Link href={`/user/applications/view?app=${app.id}`} key={app.id}
                               className="flex items-center h-16 p-3 w-full rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-100">
            <div className="h-8 w-8 mr-3">
                <AppIcon uploadable={false} size="small" app={app}/>
            </div>
            <p>{app.name}</p>
        </Link>)}

        <div className="sticky bottom-0 w-full flex justify-end mt-3">
            <Link href="/user/applications/create" className="btn">{t('create.text')}</Link>
        </div>
    </div>
}
