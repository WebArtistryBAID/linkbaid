import {useTranslation} from '@/app/i18n'
import {getApprovalRequests, getMyAppByID} from '@/app/lib/app-actions'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faHourglassEmpty} from '@fortawesome/free-solid-svg-icons'
import {AppIcon} from '@/app/user/applications/AppIcon'
import Link from 'next/link'
import {Application} from '@/generated/prisma/client'

export default async function Approvals() {
    const {t} = await useTranslation('approvals')
    const requests = await getApprovalRequests()

    if (requests.length < 1) {
        return <div className="w-full h-full flex-col flex">
            <h1 className="flex-shrink">{t('title')}</h1>
            <div className="flex-grow flex flex-col justify-center items-center">
                <FontAwesomeIcon icon={faHourglassEmpty} className="!h-16 text-gray-400 dark:text-gray-600 mb-3"/>
                <p className="text-sm">{t('noRequests')}</p>
            </div>
        </div>
    }

    const apps: Application[] = []
    for (const request of requests) {
        apps.push((await getMyAppByID(request.applicationId))!)
    }

    return <div className="h-full overflow-y-auto">
        <h1 className="mb-5">{t('title')}</h1>
        {requests.map((req, i) => <Link href={`/user/applications/view?app=${req.applicationId}`} key={req.id}
                                        className="flex items-center h-16 p-3 w-full rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-100">
            <div className="h-8 w-8 mr-3">
                <AppIcon uploadable={false} size="small" app={apps[i]}/>
            </div>
            <p>{apps[i].name}</p>
        </Link>)}
    </div>
}
