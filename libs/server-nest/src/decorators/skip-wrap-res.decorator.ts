import { SetMetadata } from '@nestjs/common'

export const SKIP_WRAP_RES = 'skipWrapRes'
export const SkipWrapRes = () => SetMetadata(SKIP_WRAP_RES, true)
