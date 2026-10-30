'use client'

import {useEffect, useState} from 'react'
import i18next from 'i18next'
import {initReactI18next, useTranslation as useTranslationOrg} from 'react-i18next'
import {useCookies} from 'react-cookie'
import resourcesToBackend from 'i18next-resources-to-backend'
import LanguageDetector from 'i18next-browser-languagedetector'
import {cookieName, getOptions, languages} from './settings'

const runsOnServerSide = typeof window === 'undefined'

i18next
    .use(initReactI18next)
    .use(LanguageDetector)
    .use(resourcesToBackend((language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`)))
    .init({
        ...getOptions(),
        lng: undefined,
        detection: {
            order: ['path', 'htmlTag', 'cookie', 'navigator']
        },
        preload: runsOnServerSide ? languages : []
    })

export function useTranslationClient(ns: string) {
    const [cookies, setCookie] = useCookies([cookieName])
    const ret = useTranslationOrg(ns)
    const {i18n} = ret
    const lng = navigator.language
    if (runsOnServerSide && lng && i18n.resolvedLanguage !== lng) {
        i18n.changeLanguage(lng)
    } else {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [activeLng, setActiveLng] = useState(i18n.resolvedLanguage)
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
            if (activeLng === i18n.resolvedLanguage) return
            setActiveLng(i18n.resolvedLanguage)
        }, [activeLng, i18n.resolvedLanguage])
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
            if (!lng || i18n.resolvedLanguage === lng) return
            i18n.changeLanguage(lng)
        }, [lng, i18n])
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
            if (cookies.i18next === lng) return
            setCookie(cookieName, lng, {path: '/'})
        }, [lng, cookies.i18next, setCookie])
    }
    return ret
}