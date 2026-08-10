import { SecondFactor } from '@libs/auth-contract'

import { BackupCodeCta, BackupCodeForm } from './backup-code'
import { TotpCta, TotpForm } from './totp'

export interface FormProps {
  readonly redirectTo?: string
}

export interface CtaProps {
  readonly onFactorChange: (factor: SecondFactor) => void
}

const TwoFactorForm: Record<SecondFactor, (props: FormProps) => React.ReactNode> = {
  [SecondFactor.TOTP]: TotpForm,
  [SecondFactor.BACKUP_CODE]: BackupCodeForm
}

const TwoFactorCta: Record<SecondFactor, (props: CtaProps) => React.ReactNode> = {
  [SecondFactor.TOTP]: TotpCta,
  [SecondFactor.BACKUP_CODE]: BackupCodeCta
}

export { TwoFactorForm, TwoFactorCta }
