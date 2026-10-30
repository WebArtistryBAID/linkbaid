'use client'

import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faUpload} from '@fortawesome/free-solid-svg-icons'
import {useRef} from 'react'
import {useTranslationClient} from '@/app/i18n/client'
import {ApplicationSimple, uploadAppIcon} from '@/app/lib/app-actions'
import CookiesBoundary from '@/app/lib/CookiesBoundary'

export function AppIcon({app, size, uploadable = false}: {
    app: ApplicationSimple,
    size: 'small' | 'big',
    uploadable?: boolean
}) {
    return <CookiesBoundary><WrappedAppIcon app={app} size={size} uploadable={uploadable}/></CookiesBoundary>
}

function WrappedAppIcon({app, size, uploadable = false}: {
    app: ApplicationSimple,
    size: 'small' | 'big',
    uploadable: boolean
}) {
    const {t} = useTranslationClient('applications')
    const input = useRef<HTMLInputElement>(null)
    const form = useRef<HTMLFormElement>(null)

    let base
    if (app.icon == null) {
        base = <div
            className={`${size == 'small' ? 'w-8 h-8' : 'w-16 h-16'} aspect-square bg-blue-500 text-white rounded-full flex justify-center items-center p-3`}>
            <p className={`${size == 'small' ? 'text-sm' : 'text-xl'} font-bold font-display`}>{app.name[0]}</p>
        </div>
    } else {
        // eslint-disable-next-line @next/next/no-img-element
        base = <img src={`/uploads${app.icon}`} alt={app.name} width={512} height={512}
                    className={`${size == 'small' ? 'w-8 h-8' : 'w-16 h-16'} aspect-square rounded-full object-cover object-center`}/>
    }
    if (uploadable) {
        return <div className={`relative ${size == 'small' ? 'w-8 h-8' : 'w-16 h-16'} rounded-full`}>
            {base}
            <button onClick={() => input.current!.click()}
                    className="absolute top-0 left-0 w-full h-full rounded-full opacity-0 hover:opacity-100 z-20 transition-opacity duration-100 bg-gray-500/50 flex justify-center items-center backdrop-blur backdrop-filter">
                <FontAwesomeIcon icon={faUpload} className="text-xl text-white" aria-label={t('view.uploadIcon')}/>
            </button>

            <form aria-hidden={true} ref={form} action={(data) => {
                uploadAppIcon(data).then(() => location.reload())
            }} className="hidden">
                <input type="text" name="id" readOnly={true} value={app.id.toString()} aria-hidden={true}/>
                <input onChange={() => form.current!.requestSubmit()} name="icon" type="file" ref={input}
                       aria-hidden={true} accept="image/*"/>
            </form>
        </div>
    }
    return base
}
