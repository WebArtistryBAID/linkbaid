import {useTranslation} from '@/app/i18n'
import {getMe} from '@/app/lib/user-actions'
import {getApps} from '@/app/lib/app-actions'
import {AppIcon} from '@/app/user/applications/AppIcon'

export default async function Home() {
    const {t} = await useTranslation('home')
    const user = await getMe()
    const apps = await getApps()

    return <div className="p-4 md:p-8 lg:p-12 xl:p-16">
        <h1 className="w-full text-center !font-normal mb-5 lg:mb-8">
            {t('welcome', {name: user.name})}
        </h1>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            <a href="https://bjzxgjb.seiue.com" className="app-block">
                <img src="/images/seiue.webp" className="rounded-full w-16 h-16 mb-3" alt=""/>
                <p className="text-lg">{t('seiue')}</p>
            </a>

            {apps.map(app => <a href={app.homepage} key={app.id} className="app-block">
                <AppIcon uploadable={false} size="big" app={app}/>
                <p className="text-lg mt-3">{app.name}</p>
            </a>)}
        </div>
    </div>
}
