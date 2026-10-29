import {NextRequest} from 'next/server'

export async function readOAuthForm(request: NextRequest): Promise<FormData> {
    const reader = request.body?.getReader()
    if (!reader) throw new Error('Missing request body')
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const {done, value} = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > 65536) {
                await reader.cancel()
                throw new Error('Request body too large')
            }
            chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }
    const data = await new Response(Buffer.concat(chunks), {
        headers: {'Content-Type': request.headers.get('Content-Type') ?? ''}
    }).formData()
    if ([...data.values()].some(value => typeof value !== 'string' || value.length > 16384)) {
        throw new Error('Invalid form')
    }
    return data
}
