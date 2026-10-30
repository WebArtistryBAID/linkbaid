import {useTranslation} from '@/app/i18n'
import Branding from '@/app/lib/Branding'
import {localRedirect} from '@/app/lib/redirect-target'
import {findUserInternalCookie} from '@/app/lib/utils'
import {redirect as navigate} from 'next/navigation'

export default async function AuthPage({searchParams}: { searchParams: never }) {
    const back = localRedirect((await searchParams)['redirect'])
    if (await findUserInternalCookie() != null) {
        navigate(new URL(back, 'https://local.invalid').pathname === '/auth' ? '/' : back)
    }
    const {t} = await useTranslation('auth')
    const redirect = `/auth/start?provider=seiue&redirect=${encodeURIComponent(back)}`
    const feishuRedirect = `/auth/start?provider=feishu&redirect=${encodeURIComponent(back)}`

    return <div className="simple-container">
        <Branding/>
        <div className="p-5 w-full h-full flex flex-col justify-center items-center">
            <h1 className="mb-1">{t('title')}</h1>
            <p className="mb-5 text-sm">{t('description')}</p>
            <div className="flex flex-col gap-3 w-full mb-5">
                <a href={redirect}
                   className="flex items-center gap-3 bg-gray-50 rounded  dark:bg-gray-800 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200">
                    <div className="bg-white rounded-full flex items-center justify-center w-8 h-8">
                        <img alt="" src="/images/seiue.webp" className="w-6 h-6 rounded-full"/>
                    </div>
                    <p>{t('loginSeiue')}</p>
                </a>
                <a href={feishuRedirect.toString()}
                   className="flex items-center gap-3 bg-gray-50 rounded  dark:bg-gray-800 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200">
                    <div className="bg-white rounded-full flex items-center justify-center w-8 h-8">
                        <img alt="" src="/images/feishu.webp" className="w-6 h-6 rounded-full"/>
                    </div>
                    <p>{t('loginFeishu')}</p>
                </a>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('message')}</p>
        </div>
    </div>
}
