import {ReactNode} from 'react'
import {CookiesProvider} from 'react-cookie'

export default function CookiesBoundary({children}: { children: ReactNode }) {
    return <CookiesProvider>{children}</CookiesProvider>
}
