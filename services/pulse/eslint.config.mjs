import baseConfig, { cleanArchitectureBoundaries, noParentRelativeImports } from '../../eslint.config.mjs'

export default [...baseConfig, ...cleanArchitectureBoundaries(), ...noParentRelativeImports()]
