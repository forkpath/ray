declare module '*.svg' {
  import type { FC } from 'react'
  import type { SvgProps } from 'react-native-svg'

  const Component: FC<SvgProps>
  export default Component
}
