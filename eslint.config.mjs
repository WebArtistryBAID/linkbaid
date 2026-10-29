import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import {readFileSync} from 'node:fs'

const {rules} = JSON.parse(readFileSync(new URL('./.eslintrc.json', import.meta.url)))
const config = [
    ...nextVitals,
    ...nextTypescript,
    // Keep the existing lint rules while upgrading the framework security patches.
    {rules: {...rules, 'react-hooks/set-state-in-effect': 'off'}},
    {ignores: ['.next/**', 'src/generated/**', 'node_modules/**']}
]

export default config
