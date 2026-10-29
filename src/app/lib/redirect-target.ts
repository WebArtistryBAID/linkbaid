export function localRedirect(value: unknown): string {
    if (typeof value !== 'string' || !value.startsWith('/') || /[\\\u0000-\u0020]/.test(value)) return '/'
    try {
        const url = new URL(value, 'https://local.invalid')
        return url.origin === 'https://local.invalid' ? url.pathname + url.search + url.hash : '/'
    } catch {
        return '/'
    }
}
