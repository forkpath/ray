import baseConfig, { noParentRelativeImports } from '../../eslint.config.mjs'

export default [...baseConfig, ...noParentRelativeImports()]
