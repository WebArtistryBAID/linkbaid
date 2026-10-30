const nextVitals = require('eslint-config-next/core-web-vitals')
const nextTypescript = require('eslint-config-next/typescript')

const {rules} = require('./.eslintrc.json')
const config = [
    ...nextVitals,
    ...nextTypescript,
    {rules: {...rules, 'react-hooks/set-state-in-effect': 'off'}},
    {ignores: ['.next/**', 'src/generated/**', 'node_modules/**']}
]

module.exports = config
