'use client'

import {redirect, useRouter} from 'next/navigation'
import {
    createApprovalRequest,
    deleteApp,
    getApprovalRequestForApp,
    getMyAppByIDSecure,
    refreshAppSecret,
    setAppApprovalStatus,
    updateApp
} from '@/app/lib/app-actions'
import {AppIcon} from '@/app/user/applications/AppIcon'
import {getMe, getUserNameByID} from '@/app/lib/user-actions'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {faCopy} from '@fortawesome/free-regular-svg-icons'
import {useTranslationClient} from '@/app/i18n/client'
import {use, useEffect, useState} from 'react'
import {$Enums, Application, ApprovalRequest, ApprovalStatus, User} from '@/generated/prisma/browser'
import {faClose, faRefresh, faWarning} from '@fortawesome/free-solid-svg-icons'
import If from '@/app/lib/If'
import CookiesBoundary from '@/app/lib/CookiesBoundary'
import Scope = $Enums.Scope

export default function WrappedApplicationView(props: { searchParams: Promise<never> }) {
    const searchParams = use(props.searchParams)
    return <CookiesBoundary><ApplicationView searchParams={searchParams}/></CookiesBoundary>
}

function ApplicationView({searchParams}: { searchParams: never }) {
    const {t} = useTranslationClient('applications')
    const [me, setMe] = useState<User | null>(null)
    const router = useRouter()

    const [copiedHighlight, setCopiedHighlight] = useState(false)
    const [copiedHighlightSecret, setCopiedHighlightSecret] = useState(false)
    const [app, setApp] = useState<Application | null>(null)
    const [ownerName, setOwnerName] = useState('')
    const [secret, setSecret] = useState<string | null>('secret' in searchParams ? searchParams['secret'] : null)

    const [message, setMessage] = useState('')
    const [homepage, setHomepage] = useState('')
    const [terms, setTerms] = useState('')
    const [privacy, setPrivacy] = useState('')
    const [redirectURIs, setRedirectURIs] = useState<string[]>([])
    const [redirectURI, setRedirectURI] = useState('')
    const [scopes, setScopes] = useState<string[]>([])
    const [accessGated, setAccessGated] = useState(false)
    const [allowedUsers, setAllowedUsers] = useState<number[]>([])
    const [allowedUser, setAllowedUser] = useState('')

    const [unsaved, setUnsaved] = useState(false)
    const [saveLoading, setSaveLoading] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const [existingApprovalRequest, setEAR] = useState<ApprovalRequest | null>(null)
    const [earLoading, setEARLoading] = useState(false)

    if (!('app' in searchParams)) {
        redirect('/user/applications')
    }

    useEffect(() => {
        const fragmentSecret = new URLSearchParams(location.hash.slice(1)).get('secret')
        if (fragmentSecret) setSecret(fragmentSecret)
        if (fragmentSecret || new URLSearchParams(location.search).has('secret')) {
            const url = new URL(location.href)
            url.searchParams.delete('secret')
            url.hash = ''
            history.replaceState(null, '', url.pathname + url.search)
        }
        (async () => {
            const a = await getMyAppByIDSecure(parseInt((await searchParams)['app']))
            if (a == null) {
                router.push('/user/applications')
                return
            }
            getUserNameByID(a.ownerId).then(setOwnerName)
            setMessage(a.message)
            setHomepage(a.homepage)
            setTerms(a.terms ?? '')
            setPrivacy(a.privacy ?? '')
            setRedirectURIs(a.redirectUrls)
            setScopes(a.scopes)
            setAccessGated(a.accessGated)
            setAllowedUsers(a.allowedUsers)
            setApp(a!)
            setMe(await getMe())
            setEAR(await getApprovalRequestForApp(a.id))
        })()
    }, [router,
        searchParams])

    if (app == null || me == null) {
        return <div>
            <h1 className="mb-5">{t('view.title')}</h1>
            <div className="rounded bg-secondary w-1/2 h-8 mb-2"></div>
            <div className="rounded bg-secondary w-full h-8 mb-2"></div>
            <div className="rounded bg-secondary w-full h-8 mb-5"></div>
            <div className="rounded bg-secondary w-2/3 h-8 mb-2"></div>
            <div className="rounded bg-secondary w-full h-8 mb-2"></div>
            <div className="rounded bg-secondary w-full h-8 mb-2"></div>
        </div>
    }

    return <div className="h-full overflow-y-auto relative" style={{transform: 'translateZ(0)'}}>
        <h1 className="mb-5">{t('view.title')}</h1>

        <div
            className="flex flex-col lg:flex-row w-full lg:justify-start lg:text-left text-center justify-center items-center mb-5">
            <div className="mb-3 lg:mb-0 lg:mr-3">
                <AppIcon uploadable={true} app={app} size="big"/>
            </div>
            <div>
                <p className="text-xl font-bold font-display">{app.name}</p>
                <p className="text-sm">{t('view.oauth')}</p>
            </div>
        </div>

        <p className="text-sm secondary">{t('view.owner')}</p>
        <p className="text-xl mb-3">{ownerName}</p>

        <p className="text-sm secondary">{t('view.approval')}</p>
        <p className={`text-xl ${app.approved === ApprovalStatus.approved ? 'mb-3' : 'mb-1'}`}>{
            app.approved === ApprovalStatus.approved ?
                <span className="text-green-500">{t('view.approved')}</span>
                : (
                    app.approved === ApprovalStatus.pending
                        ? (existingApprovalRequest == null ? t('view.pending') : t('view.requested'))
                        : <span className="text-red-500">{t('view.rejected')}</span>
                )
        }</p>

        <If condition={app.approved === ApprovalStatus.pending && me.seiueId === app.ownerId && existingApprovalRequest == null
            && app.terms != null && app.terms.length > 0 && app.privacy != null && app.privacy.length > 0 && app.message.length > 0}>
            <button onClick={async () => {
                setEARLoading(true)
                setEAR(await createApprovalRequest(app.id))
                setEARLoading(false)
            }} className="btn mb-1"
                    disabled={earLoading}>{earLoading ? t('view.requesting') : t('view.requestApproval')}</button>
        </If>
        <If condition={app.approved !== ApprovalStatus.approved}>
            <If condition={app.terms == null || app.terms.length < 1}>
                <p className="text-xs text-red-500 mb-1">{t('view.approvalTerms')}</p>
            </If>
            <If condition={app.privacy == null || app.privacy.length < 1}>
                <p className="text-xs text-red-500 mb-1">{t('view.approvalPrivacy')}</p>
            </If>
            <If condition={app.message.length < 1}>
                <p className="text-xs text-red-500 mb-1">{t('view.approvalMessage')}</p>
            </If>
        </If>
        <If condition={app.approved !== ApprovalStatus.approved}>
            <p className="text-xs secondary mb-3">{t('view.approvalInfo')}</p>
        </If>

        <p className="text-sm secondary mb-1">{t('view.clientId')}</p>
        <pre className="rounded bg-secondary p-3 mb-3 relative w-full overflow-x-auto">
            {app!.clientId}

            <button className="absolute right-3 top-2 icon-btn h-8 w-8"
                    onClick={() => {
                        navigator.clipboard.writeText(app.clientId)
                        setCopiedHighlight(true)
                        setTimeout(() => setCopiedHighlight(false), 1000)
                    }}>
                <FontAwesomeIcon icon={faCopy}
                                 className={`${copiedHighlight ? 'text-green-400' : ''} transition-colors duration-100`}/>
            </button>
        </pre>

        <p className="text-sm secondary mb-1">{t('view.clientSecret')}</p>
        {secret != null
            ? <pre className="rounded bg-secondary p-3 mb-1 relative w-full overflow-x-auto">
                {secret}

                <button className="absolute right-3 top-2 icon-btn h-8 w-8"
                        onClick={() => {
                            void navigator.clipboard.writeText(secret)
                            setCopiedHighlightSecret(true)
                            setTimeout(() => setCopiedHighlightSecret(false), 1000)
                        }}>
                    <FontAwesomeIcon icon={faCopy} aria-label={t('view.copy')}
                                     className={`${copiedHighlightSecret ? 'text-green-400' : ''} transition-colors duration-100`}/>
                </button>
            </pre>
            : <pre className="rounded bg-secondary p-3 mb-1 relative w-full overflow-x-auto">
                *******

                <button className="absolute right-3 top-2 icon-btn h-8 w-8"
                        onClick={async () => {
                            setSecret(await refreshAppSecret(app.id))
                        }}>
                    <FontAwesomeIcon icon={faRefresh} aria-label={t('view.refresh')}/>
                </button>
            </pre>}
        <p className="text-xs secondary mb-3">{t('view.clientSecretOnce')}</p>

        <p className="text-sm secondary mb-1">{t('view.message')}</p>
        <input className="text mb-1 w-full" placeholder={t('view.message')} type="text"
               onChange={(e) => {
                   setMessage(e.currentTarget.value)
                   setUnsaved(true)
               }} value={message}/>
        <p className="text-xs secondary mb-3">{t('view.messageInfo')}</p>

        <p className="text-sm secondary mb-1">{t('view.homepage')}</p>
        <input className="text mb-3 w-full" placeholder={t('view.homepage')} type="text"
               onChange={(e) => {
                   setHomepage(e.currentTarget.value)
                   setUnsaved(true)
               }} value={homepage}/>

        <p className="text-sm secondary mb-1">{t('view.terms')}</p>
        <input className="text mb-3 w-full" placeholder={t('view.terms')} type="text"
               onChange={(e) => {
                   setTerms(e.currentTarget.value)
                   setUnsaved(true)
               }} value={terms}/>

        <p className="text-sm secondary mb-1">{t('view.privacy')}</p>
        <input className="text mb-3 w-full" placeholder={t('view.privacy')} type="text"
               onChange={(e) => {
                   setPrivacy(e.currentTarget.value)
                   setUnsaved(true)
               }} value={privacy}/>

        <p className="text-sm secondary mb-1">{t('view.redirect')}</p>
        {redirectURIs.map((url, i) =>
            <pre key={i} className="rounded bg-secondary p-3 mb-1 relative w-full overflow-x-auto">
                {url}

                <button onClick={() => {
                    setRedirectURIs(redirectURIs.filter((_, j) => j !== i))
                    setUnsaved(true)
                }}
                        className="absolute right-3 top-2 icon-btn h-8 w-8">
                    <FontAwesomeIcon icon={faClose} aria-label={t('view.deleteRedirect')}/>
                </button>
            </pre>)}
        <div className="flex mb-3 items-center">
            <input className="text mr-3 flex-grow" type="text" onChange={e => setRedirectURI(e.currentTarget.value)}
                   placeholder={t('view.addRedirectPlaceholder')} value={redirectURI}/>
            <button className="btn flex-shrink" onClick={() => {
                try {
                    new URL(redirectURI)
                } catch {
                    return
                }
                setRedirectURIs([...redirectURIs, redirectURI])
                setRedirectURI('')
                setUnsaved(true)
            }}>{t('view.addRedirect')}</button>
        </div>

        <p className="text-sm secondary mb-1">{t('view.scopes')}</p>
        <div className="mb-1">
            {Object.keys(Scope).map((scope, i) => <div className="flex items-center" key={i}>
                <input type="checkbox" className="mr-3" id={scope} onChange={(e) => {
                    if (e.currentTarget.checked) {
                        setScopes([...scopes, scope])
                        setUnsaved(true)
                    } else {
                        setScopes(scopes.filter(s => s !== scope))
                        setUnsaved(true)
                    }
                }} checked={scopes.includes(scope)}/>
                <label htmlFor={scope}>{scope}</label>
            </div>)}
        </div>
        <p className="text-xs secondary mb-3">{t('view.scopesInfo')}</p>

        <p className="text-xs secondary mb-1">{t('view.accessControl')}</p>
        <div className="flex items-center mb-3">
            <input type="checkbox" id="access-gated" className="mr-3" checked={accessGated} onChange={e => {
                setAccessGated(e.currentTarget.checked)
                setUnsaved(true)
            }}/>
            <label htmlFor="access-gated">{t('view.accessControlDescription')}</label>
        </div>

        <If condition={accessGated}>
            <p className="text-xs secondary mb-1">{t('view.allowedUsers')}</p>
            {allowedUsers.map((user, i) =>
                <pre key={i} className="rounded bg-secondary p-3 mb-1 relative w-full overflow-x-auto">
                    {user.toString()}

                    <button onClick={() => {
                        setAllowedUsers(allowedUsers.filter((_, j) => j !== i))
                        setUnsaved(true)
                    }}
                            className="absolute right-3 top-2 icon-btn h-8 w-8">
                        <FontAwesomeIcon icon={faClose} aria-label={t('view.deleteUser')}/>
                    </button>
                </pre>)}

            <div className="flex mb-3 items-center">
                <input className="text mr-3 flex-grow" type="text" onChange={e => setAllowedUser(e.currentTarget.value)}
                       placeholder={t('view.addUserPlaceholder')} value={allowedUser}/>
                <button className="btn flex-shrink" onClick={() => {
                    if (isNaN(parseInt(allowedUser)) || allowedUser.length < 1 || parseInt(allowedUser) < 0) {
                        return
                    }
                    setAllowedUsers([...allowedUsers, parseInt(allowedUser)])
                    setAllowedUser('')
                    setUnsaved(true)
                }}>{t('view.addUser')}</button>
            </div>
        </If>

        <p className="text-sm secondary mb-1">{t('view.others')}</p>
        <button className="btn-danger mb-3" onClick={() => setDeleteConfirm(true)}>{t('view.delete')}</button>

        <If condition={me.admin && existingApprovalRequest != null}>
            <div
                className={`sticky bottom-0 w-full z-30`}>
                <div className="w-full flex items-center rounded bg-secondary shadow-lg">
                    <button onClick={async () => {
                        await setAppApprovalStatus(app.id, ApprovalStatus.rejected)
                        location.reload()
                    }}
                            className="btn-danger w-1/2 mr-3">{t('view.reject')}</button>
                    <button onClick={async () => {
                        await setAppApprovalStatus(app.id, ApprovalStatus.approved)
                        location.reload()
                    }} className="btn w-1/2 ml-3">{t('view.approve')}</button>
                </div>
            </div>
        </If>

        <div
            className={`sticky bottom-0 w-full transition-opacity duration-100 ${deleteConfirm ? 'z-30 opacity-100' : 'opacity-0'}`}>
            <div className="w-full flex items-center rounded bg-secondary shadow-lg pl-3">
                <FontAwesomeIcon icon={faWarning} className="flex-shrink mr-3"/>
                <p className="flex-grow py-3">{t('view.deleteConfirm')}</p>
                <button onClick={() => {
                    setDeleteConfirm(false)
                }}
                        className="btn-secondary flex-shrink">{t('view.cancel')}</button>
                <button disabled={saveLoading} onClick={async () => {
                    setDeleting(true)
                    await deleteApp(app.id)
                    router.push('/user/applications')
                }} className="btn-danger flex-shrink">{t(deleting ? 'view.deleting' : 'view.confirm')}</button>
            </div>
        </div>

        <div
            className={`sticky bottom-0 w-full transition-opacity duration-100 ${unsaved ? 'z-30 opacity-100' : 'opacity-0'}`}>
            <div className="w-full flex items-center rounded bg-secondary shadow-lg pl-3">
                <FontAwesomeIcon icon={faWarning} className="flex-shrink mr-3"/>
                <p className="flex-grow py-3">{app.approved === ApprovalStatus.approved ? t('view.changesApproved') : t('view.changes')}</p>
                <button onClick={() => {
                    setMessage(app.message)
                    setHomepage(app.homepage)
                    setTerms(app.terms ?? '')
                    setPrivacy(app.privacy ?? '')
                    setRedirectURIs(app.redirectUrls)
                    setRedirectURI('')
                    setScopes(app.scopes)
                    setAccessGated(app.accessGated)
                    setAllowedUsers(app.allowedUsers)
                    setUnsaved(false)
                }}
                        className="btn-secondary flex-shrink mr-3">{t('view.cancel')}</button>
                <button disabled={saveLoading} onClick={async () => {
                    setSaveLoading(true)
                    const a = await updateApp({
                        id: app.id,
                        message,
                        homepage,
                        terms,
                        privacy,
                        redirectUrls: redirectURIs,
                        scopes: scopes.map(s => Scope[s as keyof typeof Scope]),
                        accessGated,
                        allowedUsers
                    })
                    setMessage(a.message)
                    setHomepage(a.homepage)
                    setTerms(a.terms ?? '')
                    setPrivacy(a.privacy ?? '')
                    setRedirectURIs(a.redirectUrls)
                    setRedirectURI('')
                    setScopes(a.scopes)
                    setAccessGated(a.accessGated)
                    setAllowedUsers(a.allowedUsers)
                    setApp(a)
                    setUnsaved(false)
                    setSaveLoading(false)
                }} className="btn flex-shrink">{t(saveLoading ? 'view.saving' : 'view.save')}</button>
            </div>
        </div>
    </div>
}
