import {useTranslation} from '@/app/i18n'
import Link from 'next/link'
import {createApp} from '@/app/lib/app-actions'
import {redirect} from 'next/navigation'

export default async function ApplicationCreate() {
    const {t} = await useTranslation('applications')

    return (
        <div>
            <h1 className="mb-3">{t('create.title')}</h1>
            <p className="text-sm mb-3">{t('create.responsibility')}</p>

            <form action={async (data) => {
                'use server'
                const app = await createApp(data)
                redirect(`/user/applications/view?app=${app.id}#secret=${app.clientSecret}`)
            }}>
                <p className="mb-1 text-sm secondary">{t('create.nameInput')}</p>
                <input type="text" name="name" minLength={2} maxLength={16} className="text mb-3"
                       placeholder={t('create.nameInput')}/>
                <p className="mb-1 text-sm secondary">{t('create.homepageInput')}</p>
                <input type="text" name="homepage" minLength={2} maxLength={256} className="text mb-3"
                       placeholder={t('create.homepageInput')}/>

                <div className="flex">
                    <button type="submit" className="btn mr-3">{t('create.create')}</button>
                    <Link href="/user/applications" className="btn-secondary">{t('create.cancel')}</Link>
                </div>
            </form>
        </div>
    )
}
