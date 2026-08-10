/// <reference types="vite/client" />

// Vite SVG component contract for the Web UI boundary.
declare module '*.svg?react' {
  import * as React from 'react'
  const Component: React.FC<React.SVGProps<SVGSVGElement>>
  export default Component
}
